import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, spacing, radius, fonts, type as tp } from "@/src/theme";
import { api } from "@/src/lib/api";

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Iniciante",
  intermediate: "Intermediário",
  advanced: "Avançado",
};
const ENV_LABEL: Record<string, string> = { home: "Casa", gym: "Academia" };
const LEVEL_COLOR: Record<string, string> = {
  beginner: colors.success,
  intermediate: colors.warning,
  advanced: colors.error,
};

type Program = {
  id: string;
  name: string;
  level: string;
  environment: string;
  weeks: number;
  sessions_per_week: number;
  description: string;
};

export default function ProgramSelect() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.get("/programs");
      setPrograms(d.programs || []);
    } catch {}
    setLoading(false);
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const startProgram = async (p: Program) => {
    setStarting(p.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      await api.post("/training/start", { program_id: p.id, session_number: 1 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setStarting(null);
    }
  };

  const renderItem = ({ item }: { item: Program }) => {
    const active = starting === item.id;
    return (
      <Pressable
        style={styles.card}
        onPress={() => startProgram(item)}
        disabled={!!starting}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.levelBadge, { backgroundColor: LEVEL_COLOR[item.level] || colors.brandPrimary }]}>
            <Text style={styles.levelText}>{LEVEL_LABEL[item.level]?.toUpperCase()}</Text>
          </View>
          <View style={styles.envBadge}>
            <Ionicons
              name={item.environment === "home" ? "home" : "barbell"}
              size={14}
              color={colors.onSurfaceSecondary}
            />
            <Text style={styles.envText}>{ENV_LABEL[item.environment]}</Text>
          </View>
        </View>

        <Text style={styles.cardTitle}>{item.name}</Text>
        <Text style={styles.cardDesc} numberOfLines={3}>{item.description}</Text>

        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={14} color={colors.onSurfaceSecondary} />
            <Text style={styles.metaText}>{item.weeks} semanas</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="repeat" size={14} color={colors.onSurfaceSecondary} />
            <Text style={styles.metaText}>{item.sessions_per_week}x/semana</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="flash" size={14} color={colors.onSurfaceSecondary} />
            <Text style={styles.metaText}>{item.weeks * item.sessions_per_week} sessões</Text>
          </View>
        </View>

        <View style={[styles.startBtn, active && styles.startBtnDisabled]}>
          {active ? (
            <ActivityIndicator color={colors.onBrandPrimary} size="small" />
          ) : (
            <Text style={styles.startBtnText}>INICIAR PROGRAMA</Text>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>PREPARAÇÃO FÍSICA</Text>
          <Text style={styles.title}>PROGRAMAS</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : (
        <FlatList
          data={programs}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.xl,
          }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row", alignItems: "flex-end", gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  kicker: { fontFamily: fonts.medium, fontSize: tp.sm, color: colors.brandSecondary, letterSpacing: 2 },
  title: { fontFamily: fonts.display, fontSize: tp["3xl"], color: colors.onSurface, letterSpacing: 1 },

  card: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border,
  },
  cardHeader: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  levelBadge: {
    paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm,
  },
  levelText: { fontFamily: fonts.bold, fontSize: 10, color: "#fff", letterSpacing: 1 },
  envBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm,
    backgroundColor: colors.surfaceTertiary,
  },
  envText: { fontFamily: fonts.medium, fontSize: 10, color: colors.onSurfaceSecondary, letterSpacing: 1 },

  cardTitle: { fontFamily: fonts.display, fontSize: tp["2xl"], color: colors.onSurface, letterSpacing: 1 },
  cardDesc: {
    fontFamily: fonts.text, fontSize: tp.base, color: colors.onSurfaceSecondary,
    lineHeight: 20, marginTop: spacing.xs,
  },

  cardMeta: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.md },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontFamily: fonts.mono, fontSize: tp.sm, color: colors.onSurfaceSecondary },

  startBtn: {
    backgroundColor: colors.brandPrimary, height: 48, borderRadius: radius.md,
    alignItems: "center", justifyContent: "center", marginTop: spacing.lg,
  },
  startBtnDisabled: { opacity: 0.6 },
  startBtnText: { fontFamily: fonts.bold, fontSize: tp.base, color: colors.onBrandPrimary, letterSpacing: 1 },
});
