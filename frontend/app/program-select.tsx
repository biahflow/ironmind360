import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { spacing, radius, fonts, type as tp, shadow } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/lib/api";

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Iniciante",
  intermediate: "Intermediário",
  advanced: "Avançado",
};
const ENV_LABEL: Record<string, string> = { home: "Casa", gym: "Academia" };

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
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  const LEVEL_COLOR: Record<string, string> = {
    beginner: colors.success,
    intermediate: colors.warning,
    advanced: colors.error,
  };

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
        style={[s.card, { backgroundColor: colors.cardBackground, ...(isDark ? {} : shadow.md) }]}
        onPress={() => startProgram(item)}
        disabled={!!starting}
      >
        <View style={s.cardHeader}>
          <View style={[s.levelBadge, { backgroundColor: LEVEL_COLOR[item.level] || colors.brandPrimary }]}>
            <Text style={s.levelText}>{LEVEL_LABEL[item.level]?.toUpperCase()}</Text>
          </View>
          <View style={[s.envBadge, { backgroundColor: colors.surfaceTertiary }]}>
            <Ionicons
              name={item.environment === "home" ? "home" : "barbell"}
              size={14}
              color={colors.onSurfaceSecondary}
            />
            <Text style={[s.envText, { color: colors.onSurfaceSecondary }]}>{ENV_LABEL[item.environment]}</Text>
          </View>
        </View>

        <Text style={[s.cardTitle, { color: colors.onSurface }]}>{item.name}</Text>
        <Text style={[s.cardDesc, { color: colors.onSurfaceSecondary }]} numberOfLines={3}>{item.description}</Text>

        <View style={s.cardMeta}>
          <View style={s.metaItem}>
            <Ionicons name="calendar-outline" size={14} color={colors.onSurfaceSecondary} />
            <Text style={[s.metaText, { color: colors.onSurfaceSecondary }]}>{item.weeks} semanas</Text>
          </View>
          <View style={s.metaItem}>
            <Ionicons name="repeat" size={14} color={colors.onSurfaceSecondary} />
            <Text style={[s.metaText, { color: colors.onSurfaceSecondary }]}>{item.sessions_per_week}x/semana</Text>
          </View>
          <View style={s.metaItem}>
            <Ionicons name="flash" size={14} color={colors.onSurfaceSecondary} />
            <Text style={[s.metaText, { color: colors.onSurfaceSecondary }]}>{item.weeks * item.sessions_per_week} sessões</Text>
          </View>
        </View>

        <View style={[s.startBtn, { backgroundColor: colors.brandPrimary, ...shadow.glow(colors.brandPrimary) }, active && s.startBtnDisabled]}>
          {active ? (
            <ActivityIndicator color={colors.onBrandPrimary} size="small" />
          ) : (
            <Text style={[s.startBtnText, { color: colors.onBrandPrimary }]}>Iniciar programa</Text>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[s.root, { backgroundColor: colors.surface }]}>
      <View style={[s.header, { paddingTop: insets.top + spacing.md, borderBottomColor: colors.divider }]}>
        <Pressable onPress={() => router.back()} style={[s.backBtn, { backgroundColor: colors.surfaceSecondary }]}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[s.kicker, { color: colors.brandPrimary }]}>Treino</Text>
          <Text style={[s.title, { color: colors.onSurface }]}>Programas</Text>
        </View>
      </View>

      {loading ? (
        <View style={s.center}>
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

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row", alignItems: "flex-end", gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
  },
  kicker: { fontFamily: fonts.medium, fontSize: tp.sm, letterSpacing: 2 },
  title: { fontFamily: fonts.display, fontSize: tp["3xl"], letterSpacing: 1 },

  card: {
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  cardHeader: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  levelBadge: {
    paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill,
  },
  levelText: { fontFamily: fonts.bold, fontSize: 10, color: "#fff", letterSpacing: 1 },
  envBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill,
  },
  envText: { fontFamily: fonts.medium, fontSize: 10, letterSpacing: 1 },

  cardTitle: { fontFamily: fonts.display, fontSize: tp["2xl"], letterSpacing: 1 },
  cardDesc: {
    fontFamily: fonts.text, fontSize: tp.base,
    lineHeight: 20, marginTop: spacing.xs,
  },

  cardMeta: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.md },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontFamily: fonts.mono, fontSize: tp.sm },

  startBtn: {
    height: 52, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center", marginTop: spacing.xl,
  },
  startBtnDisabled: { opacity: 0.6 },
  startBtnText: { fontFamily: fonts.bold, fontSize: tp.base, letterSpacing: 1 },
});
