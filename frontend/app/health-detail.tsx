import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  RefreshControl, Alert, TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { spacing, radius, fonts, type as tp, shadow } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/lib/api";

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
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [doc, setDoc] = useState<HealthDoc | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const flagColor = (flag: string) => {
    if (flag === "normal") return colors.success;
    if (flag === "baixo" || flag === "alto") return colors.warning;
    return colors.error;
  };

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
      <View style={[s.container, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.brandPrimary} style={{ marginTop: 80 }} />
      </View>
    );
  }

  if (!doc) {
    return (
      <View style={[s.container, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={[s.errorText, { color: colors.onSurfaceSecondary }]}>Documento não encontrado.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[s.container, { backgroundColor: colors.surface, paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />
      }
    >
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: colors.onSurface }]} numberOfLines={2}>{doc.title || doc.original_name || "Documento"}</Text>
        </View>
        <Pressable onPress={confirmDelete} style={s.deleteBtn}>
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </Pressable>
      </View>

      <View style={[s.metaCard, { backgroundColor: colors.cardBackground, ...(isDark ? {} : shadow.sm) }]}>
        {doc.doc_type && <MetaRow label="Tipo" value={doc.doc_type} colors={colors} />}
        {doc.doc_issuer && <MetaRow label="Emissor" value={doc.doc_issuer} colors={colors} />}
        {doc.doc_date && <MetaRow label="Data do exame" value={fmtDate(doc.doc_date)} colors={colors} />}
        <MetaRow label="Enviado em" value={fmtDate(doc.created_at)} colors={colors} />
        <MetaRow label="Status" value={STATUS_LABEL[doc.status as keyof typeof STATUS_LABEL] || doc.status} colors={colors} />
        {doc.error && <MetaRow label="Erro" value={doc.error} colors={colors} />}
      </View>

      {doc.alerts?.length > 0 && (
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.onSurface }]}>Alertas</Text>
          {doc.alerts.map((alert, i) => (
            <View
              key={i}
              style={[s.alertCard, {
                backgroundColor: colors.surfaceSecondary,
                borderLeftColor: alert.level === "prioritario" ? colors.error
                  : alert.level === "atencao" ? colors.warning : colors.onSurfaceSecondary
              }]}
            >
              <Ionicons
                name={alert.level === "prioritario" ? "warning" : "alert-circle"}
                size={16}
                color={alert.level === "prioritario" ? colors.error : colors.warning}
              />
              <Text style={[s.alertTextDetail, { color: colors.onSurface }]}>{alert.text}</Text>
            </View>
          ))}
        </View>
      )}

      {Object.keys(groupedMarkers).length > 0 && (
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.onSurface }]}>Marcadores</Text>
          {Object.entries(groupedMarkers).map(([category, catMarkers]) => (
            <View key={category}>
              <Text style={[s.categoryTitle, { color: colors.brandSecondary }]}>{category}</Text>
              {catMarkers.map(marker => (
                <View key={marker.id} style={[s.markerCard, { backgroundColor: colors.cardBackground, ...(isDark ? {} : shadow.sm) }, !marker.context_enabled && s.markerDisabled]}>
                  <View style={s.markerHeader}>
                    <Text style={[s.markerName, { color: colors.onSurface }]}>{marker.name}</Text>
                    <View style={[s.flagBadge, { backgroundColor: flagColor(marker.flag) + "22" }]}>
                      <Text style={[s.flagText, { color: flagColor(marker.flag) }]}>
                        {FLAG_LABEL[marker.flag]}
                      </Text>
                    </View>
                  </View>

                  <View style={s.markerBody}>
                    {editingId === marker.id ? (
                      <View style={s.editRow}>
                        <TextInput
                          style={[s.editInput, { color: colors.onSurface, borderBottomColor: colors.brandPrimary }]}
                          value={editValue}
                          onChangeText={setEditValue}
                          keyboardType="numeric"
                          autoFocus
                          placeholder="Novo valor"
                          placeholderTextColor={colors.onSurfaceSecondary}
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
                        <Text style={[s.markerValue, { color: colors.onSurface }]}>
                          {marker.value != null ? `${marker.value} ${marker.unit || ""}` : marker.value_text || "—"}
                        </Text>
                      </Pressable>
                    )}
                    {marker.reference_text && (
                      <Text style={[s.refText, { color: colors.onSurfaceSecondary }]}>Ref: {marker.reference_text}</Text>
                    )}
                    {!marker.reference_text && (marker.reference_low != null || marker.reference_high != null) && (
                      <Text style={[s.refText, { color: colors.onSurfaceSecondary }]}>
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
                    {marker.page && <Text style={[s.pageText, { color: colors.onSurfaceSecondary }]}>Pág. {marker.page}</Text>}
                    <Text style={[s.statusChip, {
                      color: marker.status === "needs_review" ? colors.warning : colors.onSurfaceSecondary
                    }]}>
                      {STATUS_LABEL[marker.status as keyof typeof STATUS_LABEL] || marker.status}
                    </Text>
                    <Pressable onPress={() => toggleContext(marker)} style={s.contextBtn}>
                      <Ionicons
                        name={marker.context_enabled ? "eye" : "eye-off"}
                        size={16}
                        color={marker.context_enabled ? colors.success : colors.onSurfaceSecondary}
                      />
                      <Text style={[s.contextText, {
                        color: marker.context_enabled ? colors.success : colors.onSurfaceSecondary
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
        <View style={[s.failedCard, { backgroundColor: colors.cardBackground, borderColor: colors.error }]}>
          <Ionicons name="alert-circle" size={24} color={colors.error} />
          <Text style={[s.failedText, { color: colors.error }]}>
            Não foi possível processar este documento.{doc.error ? ` ${doc.error}` : ""}
          </Text>
        </View>
      )}

      {(doc.status === "extracting" || doc.status === "validating") && (
        <View style={s.processingCard}>
          <ActivityIndicator size="small" color={colors.brandPrimary} />
          <Text style={[s.processingText, { color: colors.onSurfaceSecondary }]}>Processando documento...</Text>
        </View>
      )}
    </ScrollView>
  );
}

function MetaRow({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={s.metaRow}>
      <Text style={[s.metaLabel, { color: colors.onSurfaceSecondary }]}>{label}</Text>
      <Text style={[s.metaValue, { color: colors.onSurface }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "transparent",
  },
  deleteBtn: {
    width: 44, height: 44, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontFamily: fonts.display, fontSize: tp["2xl"] },
  errorText: {
    fontFamily: fonts.text, fontSize: tp.base,
    textAlign: "center", marginTop: 40,
  },
  metaCard: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.xl, padding: spacing.xl,
  },
  metaRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  metaLabel: { fontFamily: fonts.medium, fontSize: tp.sm },
  metaValue: { fontFamily: fonts.text, fontSize: tp.sm, maxWidth: "60%", textAlign: "right" },
  section: { marginTop: spacing.xl, paddingHorizontal: spacing.lg },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: tp.lg, marginBottom: spacing.md },
  categoryTitle: {
    fontFamily: fonts.medium, fontSize: tp.sm,
    textTransform: "uppercase", letterSpacing: 1, marginTop: spacing.md, marginBottom: spacing.sm,
  },
  alertCard: {
    flexDirection: "row", alignItems: "flex-start", gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.xl, borderLeftWidth: 3, marginBottom: spacing.md,
  },
  alertTextDetail: { fontFamily: fonts.text, fontSize: tp.sm, flex: 1 },
  markerCard: {
    borderRadius: radius.lg,
    padding: spacing.xl, marginBottom: spacing.md,
  },
  markerDisabled: { opacity: 0.5 },
  markerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  markerName: { fontFamily: fonts.semibold, fontSize: tp.base, flex: 1 },
  flagBadge: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  flagText: { fontFamily: fonts.semibold, fontSize: tp.sm },
  markerBody: { marginTop: spacing.xs },
  markerValue: { fontFamily: fonts.bold, fontSize: tp.xl },
  refText: { fontFamily: fonts.text, fontSize: tp.sm, marginTop: 2 },
  markerAlert: { fontFamily: fonts.text, fontSize: tp.sm, marginTop: spacing.xs },
  markerFooter: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    marginTop: spacing.sm, flexWrap: "wrap",
  },
  pageText: { fontFamily: fonts.text, fontSize: tp.sm },
  statusChip: { fontFamily: fonts.medium, fontSize: tp.sm },
  contextBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto" },
  contextText: { fontFamily: fonts.medium, fontSize: tp.sm },
  editRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  editInput: {
    flex: 1, fontFamily: fonts.text, fontSize: tp.lg,
    borderBottomWidth: 1, paddingVertical: spacing.xs,
  },
  editSave: { padding: spacing.xs },
  editCancel: { padding: spacing.xs },
  failedCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    marginHorizontal: spacing.lg, marginTop: spacing.xl,
    borderRadius: radius.lg,
    padding: spacing.lg, borderWidth: 1,
  },
  failedText: { fontFamily: fonts.text, fontSize: tp.base, flex: 1 },
  processingCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, justifyContent: "center",
    marginHorizontal: spacing.lg, marginTop: spacing.xl, padding: spacing.lg,
  },
  processingText: { fontFamily: fonts.text, fontSize: tp.base },
});
