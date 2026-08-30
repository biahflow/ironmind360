import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator,
  RefreshControl, Alert, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as DocumentPicker from "expo-document-picker";

import { spacing, radius, fonts, type } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/lib/api";
import { Screen, ScreenHeader, PrimaryButton, EmptyState, Chip, StatusPill, layout } from "@/src/components/ui";

type Tone = "accent" | "neutral" | "success" | "warning" | "error" | "info";

const STATUS_TONE: Record<string, Tone> = {
  uploaded: "neutral",
  extracting: "warning",
  validating: "warning",
  needs_review: "warning",
  ready: "success",
  failed: "error",
};

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
  alerts: { level: string; text: string }[];
  created_at: string;
  processed_at?: string;
};

const STATUS_LABEL: Record<string, string> = {
  uploaded: "Enviado",
  extracting: "Extraindo...",
  validating: "Validando...",
  needs_review: "Revisão necessária",
  ready: "Pronto",
  failed: "Falhou",
};

function useAlertColor(colors: ReturnType<typeof useTheme>["colors"]) {
  return {
    informativo: colors.textSecondary,
    atencao: colors.warning,
    prioritario: colors.error,
  } as Record<string, string>;
}

function fmtDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function Health() {
  const { colors } = useTheme();
  const alertColor = useAlertColor(colors);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [docs, setDocs] = useState<HealthDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadDocs = useCallback(async () => {
    try {
      const data = await api.get("/health/documents");
      setDocs(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDocs();
    }, [loadDocs])
  );

  const pickAndUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/png"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setUploading(true);
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await api.uploadFile(
        "/health/documents",
        asset.uri,
        asset.name || "exame.pdf",
        asset.mimeType || "application/pdf",
      );
      await loadDocs();
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Falha ao enviar documento.");
    } finally {
      setUploading(false);
    }
  };

  const confirmDelete = (doc: HealthDoc) => {
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
              await api.del(`/health/documents/${doc.id}`);
              setDocs(prev => prev.filter(d => d.id !== doc.id));
            } catch {
              Alert.alert("Erro", "Falha ao excluir documento.");
            }
          },
        },
      ],
    );
  };

  const renderDoc = ({ item }: { item: HealthDoc }) => {
    const topAlert = item.alerts?.find(a => a.level === "prioritario") || item.alerts?.find(a => a.level === "atencao");

    return (
      <Pressable
        style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push(`/health-detail?id=${item.id}` as any)}
        onLongPress={() => confirmDelete(item)}
      >
        <View style={s.cardHeader}>
          <View style={[s.cardIcon, { backgroundColor: colors.accentMuted }]}>
            <Ionicons
              name={item.content_type === "application/pdf" ? "document-text" : "image"}
              size={24}
              color={colors.accent}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.cardTitle, { color: colors.text }]} numberOfLines={1}>
              {item.title || item.original_name || "Documento"}
            </Text>
            <View style={s.cardMeta}>
              {item.doc_type && <Chip label={item.doc_type} tone="accent" />}
              {item.doc_date && (
                <Text style={[s.metaText, { color: colors.textSecondary }]}>{fmtDate(item.doc_date)}</Text>
              )}
              {item.doc_issuer && (
                <Text style={[s.metaText, { color: colors.textSecondary }]} numberOfLines={1}>{item.doc_issuer}</Text>
              )}
            </View>
          </View>
          <StatusPill
            label={STATUS_LABEL[item.status] || item.status}
            tone={STATUS_TONE[item.status] || "neutral"}
          />
        </View>

        {item.status === "ready" && item.marker_count > 0 && (
          <Text style={[s.markerCount, { color: colors.textSecondary }]}>
            {item.marker_count} marcador{item.marker_count > 1 ? "es" : ""}
          </Text>
        )}

        {topAlert && (
          <View style={[s.alertBanner, { borderLeftColor: alertColor[topAlert.level] }]}>
            <Ionicons
              name={topAlert.level === "prioritario" ? "warning" : "alert-circle"}
              size={14}
              color={alertColor[topAlert.level]}
            />
            <Text style={[s.alertText, { color: alertColor[topAlert.level] }]} numberOfLines={2}>
              {topAlert.text}
            </Text>
          </View>
        )}

        <Text style={[s.dateText, { color: colors.textSecondary }]}>{fmtDate(item.created_at)}</Text>
      </Pressable>
    );
  };

  return (
    <Screen>
      <ScreenHeader
        title="Saúde"
        right={<PrimaryButton small label="Enviar exame" icon="cloud-upload" loading={uploading} onPress={pickAndUpload} />}
      />

      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
      ) : docs.length === 0 ? (
        <EmptyState
          icon="medkit-outline"
          title="Nenhum exame cadastrado"
          text="Envie seus exames (PDF, JPG ou PNG) para acompanhar seus marcadores de saúde."
        />
      ) : (
        <FlatList
          data={docs}
          renderItem={renderDoc}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: layout.tabBarPad(insets.bottom), paddingHorizontal: layout.screenPad }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadDocs(); }}
              tintColor={colors.accent}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: radius.card, padding: spacing.xl,
    borderWidth: 1,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  cardIcon: {
    width: 48, height: 48, borderRadius: radius.lg,
    justifyContent: "center", alignItems: "center",
  },
  cardTitle: {
    fontFamily: fonts.bold, ...type.body,
  },
  cardMeta: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs, flexWrap: "wrap", alignItems: "center" },
  metaText: { fontFamily: fonts.text, ...type.bodySmall },
  markerCount: {
    fontFamily: fonts.text, ...type.bodySmall, marginTop: spacing.md,
  },
  alertBanner: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    marginTop: spacing.lg, paddingLeft: spacing.md,
    borderLeftWidth: 3, paddingVertical: spacing.xs,
  },
  alertText: { fontFamily: fonts.text, ...type.bodySmall, flex: 1 },
  dateText: {
    fontFamily: fonts.text, ...type.bodySmall, marginTop: spacing.md, textAlign: "right",
  },
});
