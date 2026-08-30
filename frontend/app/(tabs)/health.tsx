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

function useStatusColor(colors: ReturnType<typeof useTheme>["colors"]) {
  return {
    uploaded: colors.onSurfaceSecondary,
    extracting: colors.warning,
    validating: colors.warning,
    needs_review: colors.warning,
    ready: colors.success,
    failed: colors.error,
  } as Record<string, string>;
}

function useAlertColor(colors: ReturnType<typeof useTheme>["colors"]) {
  return {
    informativo: colors.onSurfaceSecondary,
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
  const { colors, isDark } = useTheme();
  const statusColor = useStatusColor(colors);
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
        style={[s.card, { backgroundColor: colors.cardBackground, ...(isDark ? {} : shadow.sm) }]}
        onPress={() => router.push(`/health-detail?id=${item.id}` as any)}
        onLongPress={() => confirmDelete(item)}
      >
        <View style={s.cardHeader}>
          <View style={[s.cardIcon, { backgroundColor: colors.brandTertiary }]}>
            <Ionicons
              name={item.content_type === "application/pdf" ? "document-text" : "image"}
              size={24}
              color={colors.brandPrimary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.cardTitle, { color: colors.onSurface }]} numberOfLines={1}>
              {item.title || item.original_name || "Documento"}
            </Text>
            <View style={s.cardMeta}>
              {item.doc_type && (
                <Text style={[s.metaChip, { color: colors.brandSecondary, backgroundColor: colors.brandTertiary }]}>{item.doc_type}</Text>
              )}
              {item.doc_date && (
                <Text style={[s.metaText, { color: colors.onSurfaceSecondary }]}>{fmtDate(item.doc_date)}</Text>
              )}
              {item.doc_issuer && (
                <Text style={[s.metaText, { color: colors.onSurfaceSecondary }]} numberOfLines={1}>{item.doc_issuer}</Text>
              )}
            </View>
          </View>
          <View style={s.statusBadge}>
            <View style={[s.statusDot, { backgroundColor: statusColor[item.status] || colors.onSurfaceSecondary }]} />
            <Text style={[s.statusText, { color: statusColor[item.status] || colors.onSurfaceSecondary }]}>
              {STATUS_LABEL[item.status] || item.status}
            </Text>
          </View>
        </View>

        {item.status === "ready" && item.marker_count > 0 && (
          <Text style={[s.markerCount, { color: colors.onSurfaceSecondary }]}>
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

        <Text style={[s.dateText, { color: colors.onSurfaceSecondary }]}>{fmtDate(item.created_at)}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[s.container, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <View style={s.header}>
        <Text style={[s.title, { color: colors.onSurface }]}>Saúde</Text>
        <Pressable style={[s.uploadBtn, { backgroundColor: colors.brandPrimary, ...shadow.glow(colors.brandPrimary) }]} onPress={pickAndUpload} disabled={uploading}>
          {uploading ? (
            <ActivityIndicator size="small" color={colors.onBrandPrimary} />
          ) : (
            <>
              <Ionicons name="cloud-upload" size={18} color={colors.onBrandPrimary} />
              <Text style={[s.uploadText, { color: colors.onBrandPrimary }]}>Enviar exame</Text>
            </>
          )}
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.brandPrimary} style={{ marginTop: 40 }} />
      ) : docs.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="medkit-outline" size={48} color={colors.onSurfaceSecondary} />
          <Text style={[s.emptyTitle, { color: colors.onSurface }]}>Nenhum exame cadastrado</Text>
          <Text style={[s.emptySubtitle, { color: colors.onSurfaceSecondary }]}>
            Envie seus exames (PDF, JPG ou PNG) para acompanhar seus marcadores de saúde.
          </Text>
        </View>
      ) : (
        <FlatList
          data={docs}
          renderItem={renderDoc}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 90, paddingHorizontal: spacing.lg }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadDocs(); }}
              tintColor={colors.brandPrimary}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.xl,
  },
  title: { fontFamily: fonts.display, fontSize: tp["3xl"] },
  uploadBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.xl, height: 44, borderRadius: radius.pill,
  },
  uploadText: { fontFamily: fonts.semibold, fontSize: tp.sm },
  card: {
    borderRadius: radius.xl, padding: spacing.xl,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  cardIcon: {
    width: 48, height: 48, borderRadius: radius.lg,
    justifyContent: "center", alignItems: "center",
  },
  cardTitle: {
    fontFamily: fonts.semibold, fontSize: tp.lg,
  },
  cardMeta: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs, flexWrap: "wrap" },
  metaChip: {
    fontFamily: fonts.medium, fontSize: tp.sm,
    paddingHorizontal: spacing.md, paddingVertical: 2,
    borderRadius: radius.pill, overflow: "hidden",
  },
  metaText: { fontFamily: fonts.text, fontSize: tp.sm },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontFamily: fonts.medium, fontSize: tp.sm },
  markerCount: {
    fontFamily: fonts.text, fontSize: tp.sm, marginTop: spacing.md,
  },
  alertBanner: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    marginTop: spacing.lg, paddingLeft: spacing.md,
    borderLeftWidth: 3, paddingVertical: spacing.xs,
  },
  alertText: { fontFamily: fonts.text, fontSize: tp.sm, flex: 1 },
  dateText: {
    fontFamily: fonts.text, fontSize: tp.sm, marginTop: spacing.md, textAlign: "right",
  },
  empty: { alignItems: "center", paddingTop: 80, paddingHorizontal: spacing["2xl"], gap: spacing.lg },
  emptyTitle: { fontFamily: fonts.semibold, fontSize: tp.xl },
  emptySubtitle: {
    fontFamily: fonts.text, fontSize: tp.base, textAlign: "center", lineHeight: 22,
  },
});
