import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  RefreshControl, Alert, TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { spacing, radius, fonts, type } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/lib/api";
import { Screen, ScreenHeader, IconButton, Chip, layout } from "@/src/components/ui";

type Tone = "accent" | "neutral" | "success" | "warning" | "error" | "info";

function flagTone(flag: string): Tone {
  if (flag === "normal") return "success";
  if (flag === "baixo" || flag === "alto") return "warning";
  return "error";
}

type HealthDoc = {
  id: string;
  title?: string;
  original_name?: string;
  content_type: string;
  status: string;
  doc_type?: string;
  doc_issuer?: string;
  doc_date?: string;
  marker_count: number;
  alerts: { level: string; text: string; marker_id?: string }[];
  created_at: string;
  processed_at?: string;
  error?: string;
};

type Marker = {
  id: string;
  document_id: string;
  name: string;
  value?: number;
  value_text?: string;
  unit?: string;
  reference_low?: number;
  reference_high?: number;
  reference_text?: string;
  flag: string;
  page?: number;
  category?: string;
  status: string;
  alert_level?: string;
  alert_text?: string;
  context_enabled: boolean;
};

const FLAG_LABEL: Record<string, string> = {
  normal: "Normal",
  baixo: "Baixo",
  alto: "Alto",
  critico_baixo: "Crítico baixo",
  critico_alto: "Crítico alto",
};

const STATUS_LABEL: Record<string, string> = {
  validated: "Validado",
  needs_review: "Revisão",
  disabled: "Desativado",
  corrected: "Corrigido",
};

function fmtDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function HealthDetail() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [doc, setDoc] = useState<HealthDoc | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [docData, markerData] = await Promise.all([
        api.get(`/health/documents/${id}`),
        api.get(`/health/documents/${id}/markers`),
      ]);
      setDoc(docData);
      setMarkers(markerData);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggleContext = async (marker: Marker) => {
    try {
      const updated = await api.patch(`/health/markers/${marker.id}/context`, {
        enabled: !marker.context_enabled,
      });
      setMarkers(prev => prev.map(m => m.id === marker.id ? { ...m, ...updated } : m));
    } catch {
      Alert.alert("Erro", "Falha ao atualizar marcador.");
    }
  };

  const submitCorrection = async (marker: Marker) => {
    const val = parseFloat(editValue);
    if (isNaN(val)) {
      Alert.alert("Erro", "Valor inválido.");
      return;
    }
    try {
      const updated = await api.patch(`/health/markers/${marker.id}`, { value: val });
      setMarkers(prev => prev.map(m => m.id === marker.id ? { ...m, ...updated } : m));
      setEditingId(null);
    } catch {
      Alert.alert("Erro", "Falha ao corrigir marcador.");
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      "Excluir documento",
      "Isso removerá o documento, todos os marcadores e análises derivadas. Essa ação não pode ser desfeita.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await api.del(`/health/documents/${id}`);
              router.back();
            } catch {
              Alert.alert("Erro", "Falha ao excluir.");
            }
          },
        },
      ],
    );
  };

  const groupedMarkers = markers.reduce<Record<string, Marker[]>>((acc, m) => {
    const cat = m.category || "Outros";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(m);
    return acc;
  }, {});

  if (loading) {
    return (
      <Screen>
        <ScreenHeader title="Documento" onBack={() => router.back()} />
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 80 }} />
      </Screen>
    );
  }

  if (!doc) {
    return (
      <Screen>
        <ScreenHeader title="Documento" onBack={() => router.back()} />
        <Text style={[s.errorText, { color: colors.textSecondary }]}>Documento não encontrado.</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title={doc.title || doc.original_name || "Documento"}
        onBack={() => router.back()}
        right={<IconButton icon="trash-outline" color={colors.error} onPress={confirmDelete} />}
      />
      <ScrollView
        style={s.container}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} />
        }
      >
        <View style={[s.metaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {doc.doc_type && <MetaRow label="Tipo" value={doc.doc_type} colors={colors} />}
          {doc.doc_issuer && <MetaRow label="Emissor" value={doc.doc_issuer} colors={colors} />}
          {doc.doc_date && <MetaRow label="Data do exame" value={fmtDate(doc.doc_date)} colors={colors} />}
          <MetaRow label="Enviado em" value={fmtDate(doc.created_at)} colors={colors} />
          <MetaRow label="Status" value={STATUS_LABEL[doc.status as keyof typeof STATUS_LABEL] || doc.status} colors={colors} />
          {doc.error && <MetaRow label="Erro" value={doc.error} colors={colors} />}
        </View>

        {doc.alerts?.length > 0 && (
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: colors.text }]}>Alertas</Text>
            {doc.alerts.map((alert, i) => (
              <View
                key={i}
                style={[s.alertCard, {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderLeftColor: alert.level === "prioritario" ? colors.error
                    : alert.level === "atencao" ? colors.warning : colors.textSecondary
                }]}
              >
                <Ionicons
                  name={alert.level === "prioritario" ? "warning" : "alert-circle"}
                  size={16}
                  color={alert.level === "prioritario" ? colors.error : colors.warning}
                />
                <Text style={[s.alertTextDetail, { color: colors.text }]}>{alert.text}</Text>
              </View>
            ))}
          </View>
        )}

        {Object.keys(groupedMarkers).length > 0 && (
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: colors.text }]}>Marcadores</Text>
            {Object.entries(groupedMarkers).map(([category, catMarkers]) => (
              <View key={category}>
                <Text style={[s.categoryTitle, { color: colors.accent }]}>{category}</Text>
                {catMarkers.map(marker => (
                  <View key={marker.id} style={[s.markerCard, { backgroundColor: colors.surface, borderColor: colors.border }, !marker.context_enabled && s.markerDisabled]}>
                    <View style={s.markerHeader}>
                      <Text style={[s.markerName, { color: colors.text }]}>{marker.name}</Text>
                      <Chip label={FLAG_LABEL[marker.flag]} tone={flagTone(marker.flag)} />
                    </View>

                    <View style={s.markerBody}>
                      {editingId === marker.id ? (
                        <View style={s.editRow}>
                          <TextInput
                            style={[s.editInput, { color: colors.text, borderBottomColor: colors.accent }]}
                            value={editValue}
                            onChangeText={setEditValue}
                            keyboardType="numeric"
                            autoFocus
                            placeholder="Novo valor"
                            placeholderTextColor={colors.textSecondary}
                          />
                          <Pressable onPress={() => submitCorrection(marker)} style={s.editSave}>
                            <Ionicons name="checkmark" size={18} color={colors.success} />
                          </Pressable>
                          <Pressable onPress={() => setEditingId(null)} style={s.editCancel}>
                            <Ionicons name="close" size={18} color={colors.error} />
                          </Pressable>
                        </View>
                      ) : (
                        <Pressable onPress={() => { setEditingId(marker.id); setEditValue(String(marker.value ?? "")); }}>
                          <Text style={[s.markerValue, { color: colors.text }]}>
                            {marker.value != null ? `${marker.value} ${marker.unit || ""}` : marker.value_text || "—"}
                          </Text>
                        </Pressable>
                      )}
                      {marker.reference_text && (
                        <Text style={[s.refText, { color: colors.textSecondary }]}>Ref: {marker.reference_text}</Text>
                      )}
                      {!marker.reference_text && (marker.reference_low != null || marker.reference_high != null) && (
                        <Text style={[s.refText, { color: colors.textSecondary }]}>
                          Ref: {marker.reference_low ?? "—"} – {marker.reference_high ?? "—"} {marker.unit || ""}
                        </Text>
                      )}
                    </View>

                    {marker.alert_text && (
                      <Text style={[s.markerAlert, {
                        color: marker.alert_level === "prioritario" ? colors.error : colors.warning
                      }]}>
                        {marker.alert_text}
                      </Text>
                    )}

                    <View style={s.markerFooter}>
                      {marker.page && <Text style={[s.pageText, { color: colors.textSecondary }]}>Pág. {marker.page}</Text>}
                      <Text style={[s.statusChip, {
                        color: marker.status === "needs_review" ? colors.warning : colors.textSecondary
                      }]}>
                        {STATUS_LABEL[marker.status as keyof typeof STATUS_LABEL] || marker.status}
                      </Text>
                      <Pressable onPress={() => toggleContext(marker)} style={s.contextBtn}>
                        <Ionicons
                          name={marker.context_enabled ? "eye" : "eye-off"}
                          size={16}
                          color={marker.context_enabled ? colors.success : colors.textSecondary}
                        />
                        <Text style={[s.contextText, {
                          color: marker.context_enabled ? colors.success : colors.textSecondary
                        }]}>
                          {marker.context_enabled ? "No contexto" : "Fora do contexto"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {doc.status === "failed" && (
          <View style={[s.failedCard, { backgroundColor: colors.surface, borderColor: colors.error }]}>
            <Ionicons name="alert-circle" size={24} color={colors.error} />
            <Text style={[s.failedText, { color: colors.error }]}>
              Não foi possível processar este documento.{doc.error ? ` ${doc.error}` : ""}
            </Text>
          </View>
        )}

        {(doc.status === "extracting" || doc.status === "validating") && (
          <View style={s.processingCard}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[s.processingText, { color: colors.textSecondary }]}>Processando documento...</Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function MetaRow({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={s.metaRow}>
      <Text style={[s.metaLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[s.metaValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  errorText: {
    fontFamily: fonts.text, ...type.body,
    textAlign: "center", marginTop: 40,
  },
  metaCard: {
    marginHorizontal: layout.screenPad,
    borderRadius: radius.card, padding: spacing.xl,
    borderWidth: 1,
  },
  metaRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  metaLabel: { fontFamily: fonts.medium, ...type.bodySmall },
  metaValue: { fontFamily: fonts.text, ...type.bodySmall, maxWidth: "60%", textAlign: "right" },
  section: { marginTop: spacing.xl, paddingHorizontal: layout.screenPad },
  sectionTitle: { fontFamily: fonts.bold, ...type.h2, marginBottom: spacing.md },
  categoryTitle: {
    fontFamily: fonts.medium, ...type.bodySmall,
    textTransform: "uppercase", letterSpacing: 1, marginTop: spacing.md, marginBottom: spacing.sm,
  },
  alertCard: {
    flexDirection: "row", alignItems: "flex-start", gap: spacing.md,
    borderRadius: radius.card, borderWidth: 1,
    padding: spacing.xl, borderLeftWidth: 3, marginBottom: spacing.md,
  },
  alertTextDetail: { fontFamily: fonts.text, ...type.bodySmall, flex: 1 },
  markerCard: {
    borderRadius: radius.card, borderWidth: 1,
    padding: spacing.xl, marginBottom: spacing.md,
  },
  markerDisabled: { opacity: 0.5 },
  markerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  markerName: { fontFamily: fonts.bold, ...type.body, flex: 1 },
  markerBody: { marginTop: spacing.xs },
  markerValue: { fontFamily: fonts.bold, ...type.metric },
  refText: { fontFamily: fonts.text, ...type.bodySmall, marginTop: 2 },
  markerAlert: { fontFamily: fonts.text, ...type.bodySmall, marginTop: spacing.xs },
  markerFooter: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    marginTop: spacing.sm, flexWrap: "wrap",
  },
  pageText: { fontFamily: fonts.text, ...type.bodySmall },
  statusChip: { fontFamily: fonts.medium, ...type.bodySmall },
  contextBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto" },
  contextText: { fontFamily: fonts.medium, ...type.bodySmall },
  editRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  editInput: {
    flex: 1, fontFamily: fonts.text, ...type.body,
    borderBottomWidth: 1, paddingVertical: spacing.xs,
  },
  editSave: { padding: spacing.xs },
  editCancel: { padding: spacing.xs },
  failedCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    marginHorizontal: layout.screenPad, marginTop: spacing.xl,
    borderRadius: radius.card,
    padding: spacing.lg, borderWidth: 1,
  },
  failedText: { fontFamily: fonts.text, ...type.body, flex: 1 },
  processingCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, justifyContent: "center",
    marginHorizontal: layout.screenPad, marginTop: spacing.xl, padding: spacing.lg,
  },
  processingText: { fontFamily: fonts.text, ...type.body },
});
