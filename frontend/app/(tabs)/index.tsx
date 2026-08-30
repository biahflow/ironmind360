import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { spacing, radius, fonts, type, shadow } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/lib/api";
import ProgressRing from "@/src/components/ProgressRing";

const MOODS = ["😣", "😕", "😐", "🙂", "🔥"];

function greetingLabel() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function Home() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const tabBarPad = 64 + insets.bottom + spacing.lg;

  const load = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([
        api.get("/dashboard"),
        api.get("/training/active"),
      ]);
      setData(d);
      setPlan(p?.plan || null);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const patchHabit = async (patch: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setData((prev: any) => ({ ...prev, ...patch }));
    try {
      await api.put("/habits", { date: data?.date, ...patch });
      await load();
    } catch {}
  };

  if (loading || !data) {
    return (
      <View style={[s.center, { backgroundColor: colors.surface }]}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }

  const g = data.goals || {};
  const water = data.water_ml || 0;
  const scorePct = (data.discipline_score || 0) / 100;
  const calPct = Math.min(1, (data.calories || 0) / Math.max(g.calories || 1, 1));
  const waterPct = Math.min(1, water / Math.max(g.water_ml || 1, 1));
  const sleepPct = Math.min(1, (data.sleep_hours || 0) / Math.max(g.sleep_hours || 1, 1));

  const cardStyle = [
    s.card,
    {
      backgroundColor: colors.cardBackground,
      ...(isDark ? {} : shadow.sm),
    },
  ];

  return (
    <View style={[s.root, { backgroundColor: colors.surface }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.greeting, { color: colors.onSurfaceSecondary }]}>{greetingLabel()} 👋</Text>
          <Text style={[s.name, { color: colors.onSurface }]}>{data.name || "Atleta"}</Text>
        </View>
        <Pressable
          testID="settings-button"
          onPress={() => router.push("/settings")}
          style={[s.avatarBtn, { backgroundColor: colors.brandTertiary }]}
        >
          <Ionicons name="person" size={20} color={colors.brandPrimary} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: tabBarPad, paddingTop: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
      >
        {/* Hero score card */}
        <View
          style={[
            s.heroCard,
            {
              backgroundColor: colors.cardBackground,
              ...(isDark ? {} : shadow.md),
            },
          ]}
          testID="discipline-score-card"
        >
          <View style={s.heroContent}>
            <View style={s.heroLeft}>
              <Text style={[s.heroLabel, { color: colors.onSurfaceSecondary }]}>Seu progresso de hoje</Text>
              <View style={s.heroScoreRow}>
                <Text style={[s.heroScore, { color: colors.onSurface }]} testID="discipline-score-value">{data.discipline_score}</Text>
                <Text style={[s.heroPct, { color: colors.brandPrimary }]}>%</Text>
              </View>
              <Text style={[s.heroSub, { color: colors.onSurfaceSecondary }]}>Score de disciplina</Text>
              <View style={[s.streakPill, { backgroundColor: colors.brandTertiary }]}>
                <Ionicons name="flame" size={14} color={colors.brandPrimary} />
                <Text style={[s.streakText, { color: colors.brandPrimary }]}>{data.streak} dias seguidos</Text>
              </View>
            </View>
            <ProgressRing size={120} strokeWidth={12} progress={scorePct}>
              <Ionicons name="trophy" size={28} color={colors.brandPrimary} />
            </ProgressRing>
          </View>
        </View>

        {/* Daily goals */}
        <Text style={[s.section, { color: colors.onSurface }]}>Metas do dia</Text>
        <View style={s.goalRow}>
          <GoalCard
            icon="water"
            iconColor="#4ECDC4"
            label="Água"
            value={`${(water / 1000).toFixed(1)}L`}
            pct={waterPct}
            colors={colors}
            isDark={isDark}
          />
          <GoalCard
            icon="flame"
            iconColor="#FF6B6B"
            label="Calorias"
            value={`${Math.round(data.calories || 0)}`}
            pct={calPct}
            colors={colors}
            isDark={isDark}
          />
          <GoalCard
            icon="moon"
            iconColor="#9B59B6"
            label="Sono"
            value={`${(data.sleep_hours || 0).toFixed(1)}h`}
            pct={sleepPct}
            colors={colors}
            isDark={isDark}
          />
        </View>

        {/* Next workout */}
        {plan && plan.status !== "completed" && (
          <Pressable
            testID="training-plan-card"
            style={[
              s.workoutCard,
              {
                backgroundColor: colors.brandPrimary,
                ...shadow.glow(colors.brandPrimary),
              },
            ]}
            onPress={() => router.push("/session")}
          >
            <View style={s.workoutLeft}>
              <Text style={[s.workoutKicker, { color: "rgba(0,0,0,0.5)" }]}>PRÓXIMO TREINO</Text>
              <Text style={[s.workoutName, { color: colors.onBrandPrimary }]} numberOfLines={1}>{plan.program_name}</Text>
              <Text style={[s.workoutMeta, { color: "rgba(0,0,0,0.6)" }]}>
                Sessão {plan.current_session} de {plan.total_sessions}
              </Text>
            </View>
            <View style={[s.workoutPlayBtn, { backgroundColor: "rgba(0,0,0,0.15)" }]}>
              <Ionicons name="play" size={24} color={colors.onBrandPrimary} />
            </View>
          </Pressable>
        )}

        {/* Challenge */}
        <View style={cardStyle} testID="daily-challenge-card">
          <View style={s.challengeRow}>
            <View style={[s.challengeIconWrap, { backgroundColor: colors.brandTertiary }]}>
              <Ionicons name="trophy" size={20} color={colors.brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.challengeLabel, { color: colors.brandPrimary }]}>Desafio do dia</Text>
              <Text style={[s.challengeText, { color: colors.onSurface }]}>{data.daily_challenge}</Text>
            </View>
          </View>
        </View>

        {/* Weekly stats */}
        <Text style={[s.section, { color: colors.onSurface }]}>Esta semana</Text>
        <View style={s.statRow}>
          <StatPill icon="barbell" value={data.weekly_workouts} label="Sessões" colors={colors} isDark={isDark} />
          <StatPill icon="navigate" value={`${data.weekly_km}`} label="Km" colors={colors} isDark={isDark} />
          <StatPill icon="trending-up" value={data.weekly_load} label="Carga" colors={colors} isDark={isDark} />
        </View>
        {!data.intervals_connected && (
          <Pressable testID="connect-intervals-cta" style={[s.connectCard, cardStyle]} onPress={() => router.push("/settings")}>
            <View style={[s.connectIconWrap, { backgroundColor: colors.brandTertiary }]}>
              <Ionicons name="link" size={18} color={colors.brandPrimary} />
            </View>
            <Text style={[s.connectText, { color: colors.onSurface }]}>Conectar intervals.icu</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />
          </Pressable>
        )}

        {/* Quick controls: water + sleep */}
        <Text style={[s.section, { color: colors.onSurface }]}>Registro rápido</Text>
        <View style={cardStyle}>
          <QuickRow
            icon="water"
            iconColor="#4ECDC4"
            label="Água"
            value={`${(water / 1000).toFixed(1)}`}
            unit="L"
            onMinus={() => patchHabit({ water_ml: Math.max(0, water - 250) })}
            onPlus={() => patchHabit({ water_ml: water + 250 })}
            minusTestID="water-minus"
            plusTestID="water-plus"
            colors={colors}
          />
          <View style={[s.separator, { backgroundColor: colors.divider }]} />
          <QuickRow
            icon="moon"
            iconColor="#9B59B6"
            label="Sono"
            value={`${(data.sleep_hours || 0).toFixed(1)}`}
            unit="h"
            onMinus={() => patchHabit({ sleep_hours: Math.max(0, (data.sleep_hours || 0) - 0.5) })}
            onPlus={() => patchHabit({ sleep_hours: (data.sleep_hours || 0) + 0.5 })}
            minusTestID="sleep-minus"
            plusTestID="sleep-plus"
            colors={colors}
          />
        </View>

        {/* Habits */}
        <Text style={[s.section, { color: colors.onSurface }]}>Hábitos diários</Text>
        <View style={s.habitRow}>
          <HabitChip testID="toggle-meditate" icon="leaf" label="Meditar" active={data.meditate} onPress={() => patchHabit({ meditate: !data.meditate })} colors={colors} />
          <HabitChip testID="toggle-read" icon="book" label="Ler" active={data.read} onPress={() => patchHabit({ read: !data.read })} colors={colors} />
          <HabitChip testID="toggle-cold" icon="snow" label="Gelado" active={data.cold_shower} onPress={() => patchHabit({ cold_shower: !data.cold_shower })} colors={colors} />
        </View>

        {/* Mood */}
        <Text style={[s.section, { color: colors.onSurface }]}>Como você está?</Text>
        <View style={cardStyle}>
          <Text style={[s.moodLabel, { color: colors.onSurfaceSecondary }]}>Humor</Text>
          <View style={s.moodRow}>
            {MOODS.map((m, i) => (
              <Pressable
                key={i}
                testID={`mood-${i + 1}`}
                style={[
                  s.moodChip,
                  {
                    backgroundColor: data.mood === i + 1 ? colors.brandTertiary : colors.surfaceTertiary,
                    borderColor: data.mood === i + 1 ? colors.brandPrimary : "transparent",
                    borderWidth: data.mood === i + 1 ? 2 : 0,
                  },
                ]}
                onPress={() => patchHabit({ mood: i + 1 })}
              >
                <Text style={s.moodEmoji}>{m}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[s.moodLabel, { marginTop: spacing.xl, color: colors.onSurfaceSecondary }]}>Nível de ansiedade</Text>
          <View style={s.moodRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                testID={`anxiety-${n}`}
                style={[
                  s.anxChip,
                  {
                    backgroundColor: data.anxiety === n ? colors.brandPrimary : colors.surfaceTertiary,
                  },
                ]}
                onPress={() => patchHabit({ anxiety: n })}
              >
                <Text style={[s.anxText, { color: data.anxiety === n ? colors.onBrandPrimary : colors.onSurfaceSecondary }]}>{n}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function GoalCard({ icon, iconColor, label, value, pct, colors, isDark }: any) {
  return (
    <View style={[s.goalCard, { backgroundColor: colors.cardBackground, ...(isDark ? {} : shadow.sm) }]}>
      <View style={[s.goalIconWrap, { backgroundColor: iconColor + "18" }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={[s.goalValue, { color: colors.onSurface }]}>{value}</Text>
      <Text style={[s.goalLabel, { color: colors.onSurfaceSecondary }]}>{label}</Text>
      <View style={[s.goalTrack, { backgroundColor: colors.surfaceTertiary }]}>
        <View style={[s.goalFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: iconColor }]} />
      </View>
      <Text style={[s.goalPctText, { color: colors.onSurfaceSecondary }]}>{Math.round(pct * 100)}%</Text>
    </View>
  );
}

function StatPill({ icon, value, label, colors, isDark }: any) {
  return (
    <View style={[s.statPill, { backgroundColor: colors.cardBackground, ...(isDark ? {} : shadow.sm) }]}>
      <Ionicons name={icon} size={16} color={colors.brandPrimary} />
      <Text style={[s.statValue, { color: colors.onSurface }]}>{value}</Text>
      <Text style={[s.statLabel, { color: colors.onSurfaceSecondary }]}>{label}</Text>
    </View>
  );
}

function QuickRow({ icon, iconColor, label, value, unit, onMinus, onPlus, minusTestID, plusTestID, colors }: any) {
  return (
    <View style={s.quickRow}>
      <View style={[s.quickIconWrap, { backgroundColor: iconColor + "18" }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.quickLabel, { color: colors.onSurfaceSecondary }]}>{label}</Text>
        <Text style={[s.quickValue, { color: colors.onSurface }]}>{value}<Text style={[s.quickUnit, { color: colors.onSurfaceSecondary }]}> {unit}</Text></Text>
      </View>
      <View style={s.quickBtns}>
        <Pressable testID={minusTestID} style={[s.qBtn, { backgroundColor: colors.surfaceTertiary }]} onPress={onMinus}>
          <Ionicons name="remove" size={18} color={colors.onSurface} />
        </Pressable>
        <Pressable testID={plusTestID} style={[s.qBtn, s.qBtnPrimary, { backgroundColor: colors.brandPrimary }]} onPress={onPlus}>
          <Ionicons name="add" size={18} color={colors.onBrandPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

function HabitChip({ testID, icon, label, active, onPress, colors }: any) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[
        s.habitChip,
        {
          backgroundColor: active ? colors.brandPrimary : colors.cardBackground,
          ...(active ? shadow.glow(colors.brandPrimary) : {}),
        },
      ]}
    >
      <Ionicons name={icon} size={24} color={active ? colors.onBrandPrimary : colors.onSurfaceSecondary} />
      <Text style={[s.habitLabel, { color: active ? colors.onBrandPrimary : colors.onSurfaceSecondary }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.xl, paddingBottom: spacing.lg,
  },
  greeting: { fontFamily: fonts.medium, fontSize: type.lg },
  name: { fontFamily: fonts.bold, fontSize: type["2xl"], marginTop: 2 },
  avatarBtn: {
    width: 48, height: 48, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
  },

  // Hero
  heroCard: { borderRadius: radius.xl, padding: spacing.xl, marginBottom: spacing.xl },
  heroContent: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroLeft: { flex: 1, marginRight: spacing.lg },
  heroLabel: { fontFamily: fonts.medium, fontSize: type.sm },
  heroScoreRow: { flexDirection: "row", alignItems: "flex-end", marginTop: spacing.xs },
  heroScore: { fontFamily: fonts.display, fontSize: 64, lineHeight: 68, fontVariant: ["tabular-nums"] },
  heroPct: { fontFamily: fonts.display, fontSize: type["2xl"], marginBottom: 8, marginLeft: 2 },
  heroSub: { fontFamily: fonts.text, fontSize: type.sm, marginTop: 2 },
  streakPill: {
    flexDirection: "row", alignItems: "center", alignSelf: "flex-start",
    gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill, marginTop: spacing.md,
  },
  streakText: { fontFamily: fonts.semibold, fontSize: type.sm },

  // Section
  section: { fontFamily: fonts.bold, fontSize: type.lg, marginTop: spacing["2xl"], marginBottom: spacing.lg },

  // Goal cards
  goalRow: { flexDirection: "row", gap: spacing.md },
  goalCard: {
    flex: 1, borderRadius: radius.lg, padding: spacing.lg,
    alignItems: "center", gap: spacing.xs,
  },
  goalIconWrap: {
    width: 40, height: 40, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.xs,
  },
  goalValue: { fontFamily: fonts.bold, fontSize: type.xl, fontVariant: ["tabular-nums"] },
  goalLabel: { fontFamily: fonts.medium, fontSize: type.xs },
  goalTrack: { height: 4, borderRadius: radius.pill, width: "100%", overflow: "hidden", marginTop: spacing.sm },
  goalFill: { height: 4, borderRadius: radius.pill },
  goalPctText: { fontFamily: fonts.medium, fontSize: type.xs, marginTop: 2 },

  // Workout CTA
  workoutCard: {
    borderRadius: radius.xl, padding: spacing.xl, marginTop: spacing.xl,
    flexDirection: "row", alignItems: "center",
  },
  workoutLeft: { flex: 1 },
  workoutKicker: { fontFamily: fonts.bold, fontSize: type.xs, letterSpacing: 1 },
  workoutName: { fontFamily: fonts.bold, fontSize: type.xl, marginTop: 4 },
  workoutMeta: { fontFamily: fonts.medium, fontSize: type.sm, marginTop: 2 },
  workoutPlayBtn: {
    width: 52, height: 52, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
  },

  // Card base
  card: { borderRadius: radius.lg, padding: spacing.xl, marginTop: spacing.md },

  // Challenge
  challengeRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.lg },
  challengeIconWrap: {
    width: 44, height: 44, borderRadius: radius.md,
    alignItems: "center", justifyContent: "center",
  },
  challengeLabel: { fontFamily: fonts.bold, fontSize: type.xs, letterSpacing: 1, textTransform: "uppercase" },
  challengeText: { fontFamily: fonts.medium, fontSize: type.base, lineHeight: 22, marginTop: spacing.xs },

  // Stats
  statRow: { flexDirection: "row", gap: spacing.md },
  statPill: {
    flex: 1, borderRadius: radius.lg, paddingVertical: spacing.lg,
    alignItems: "center", gap: spacing.xs,
  },
  statValue: { fontFamily: fonts.bold, fontSize: type["2xl"], fontVariant: ["tabular-nums"] },
  statLabel: { fontFamily: fonts.medium, fontSize: type.xs },

  // Connect CTA
  connectCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
  },
  connectIconWrap: {
    width: 40, height: 40, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
  },
  connectText: { flex: 1, fontFamily: fonts.medium, fontSize: type.base },

  // Quick controls
  quickRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md },
  quickIconWrap: {
    width: 44, height: 44, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center", marginRight: spacing.lg,
  },
  quickLabel: { fontFamily: fonts.medium, fontSize: type.sm },
  quickValue: { fontFamily: fonts.bold, fontSize: type.xl, fontVariant: ["tabular-nums"] },
  quickUnit: { fontFamily: fonts.medium, fontSize: type.base },
  quickBtns: { flexDirection: "row", gap: spacing.sm },
  qBtn: {
    width: 44, height: 44, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
  },
  qBtnPrimary: {},
  separator: { height: 1, marginVertical: spacing.sm },

  // Habits
  habitRow: { flexDirection: "row", gap: spacing.md },
  habitChip: {
    flex: 1, borderRadius: radius.lg, paddingVertical: spacing.xl,
    alignItems: "center", gap: spacing.sm,
  },
  habitLabel: { fontFamily: fonts.semibold, fontSize: type.sm },

  // Mood
  moodLabel: { fontFamily: fonts.semibold, fontSize: type.sm, marginBottom: spacing.md },
  moodRow: { flexDirection: "row", gap: spacing.sm },
  moodChip: {
    flex: 1, aspectRatio: 1, borderRadius: radius.md,
    alignItems: "center", justifyContent: "center",
  },
  moodEmoji: { fontSize: 26 },
  anxChip: {
    flex: 1, height: 48, borderRadius: radius.md,
    alignItems: "center", justifyContent: "center",
  },
  anxText: { fontFamily: fonts.bold, fontSize: type.lg },
});
