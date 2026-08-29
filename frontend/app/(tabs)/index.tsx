import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, spacing, radius, fonts, type } from "@/src/theme";
import { api } from "@/src/lib/api";
import ProgressRing from "@/src/components/ProgressRing";

const MOODS = ["😣", "😕", "😐", "🙂", "🔥"];

function scoreLabel(s: number) {
  if (s >= 80) return "IMPARÁVEL";
  if (s >= 60) return "NO CAMINHO";
  if (s >= 40) return "MORNO";
  if (s >= 20) return "FRACO";
  return "COMECE JÁ";
}

export default function CommandCenter() {
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
    // optimistic
    setData((prev: any) => ({ ...prev, ...patch }));
    try {
      await api.put("/habits", { date: data?.date, ...patch });
      await load();
    } catch {}
  };

  if (loading || !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }

  const g = data.goals || {};
  const water = data.water_ml || 0;

  return (
    <View style={styles.root}>
      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View>
          <Text style={styles.hello}>OPERADOR</Text>
          <Text style={styles.name}>{data.name?.toUpperCase()}</Text>
        </View>
        <Pressable testID="settings-button" onPress={() => router.push("/settings")} style={styles.iconBtn}>
          <Ionicons name="settings-outline" size={22} color={colors.onSurface} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: tabBarPad }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
      >
        {/* Discipline Score */}
        <View style={styles.scoreCard} testID="discipline-score-card">
          <ProgressRing size={200} strokeWidth={16} progress={data.discipline_score / 100}>
            <Text style={styles.scoreNum} testID="discipline-score-value">{data.discipline_score}</Text>
            <Text style={styles.scoreLabel}>{scoreLabel(data.discipline_score)}</Text>
          </ProgressRing>
          <View style={styles.streakRow}>
            <Ionicons name="flame" size={18} color={colors.brandPrimary} />
            <Text style={styles.streakText}>{data.streak} DIAS DE OFENSIVA</Text>
          </View>
          <Text style={styles.scoreCaption}>Score de Disciplina · Hoje</Text>
        </View>

        {/* Training plan progress */}
        {plan && plan.status !== "completed" && (
          <Pressable
            testID="training-plan-card"
            style={styles.trainingCard}
            onPress={() => router.push("/session")}
          >
            <View style={styles.trainingLeft}>
              <Text style={styles.trainingKicker}>PREPARAÇÃO FÍSICA</Text>
              <Text style={styles.trainingName} numberOfLines={1}>{plan.program_name}</Text>
              <Text style={styles.trainingMeta}>
                Sessão {plan.current_session} de {plan.total_sessions}
              </Text>
            </View>
            <View style={styles.trainingRight}>
              <ProgressRing size={56} strokeWidth={5} progress={plan.completed_sessions / plan.total_sessions}>
                <Text style={styles.trainingPct}>
                  {Math.round((plan.completed_sessions / plan.total_sessions) * 100)}%
                </Text>
              </ProgressRing>
            </View>
          </Pressable>
        )}

        {/* Daily Challenge */}
        <View style={styles.challengeCard} testID="daily-challenge-card">
          <Text style={styles.challengeKicker}>DESAFIO DO DIA</Text>
          <Text style={styles.challengeText}>{data.daily_challenge}</Text>
        </View>

        {/* Weekly training stats */}
        <Text style={styles.sectionTitle}>TREINO · 7 DIAS</Text>
        <View style={styles.statRow}>
          <Stat value={data.weekly_workouts} label="SESSÕES" />
          <Stat value={`${data.weekly_km}`} label="KM" />
          <Stat value={data.weekly_load} label="CARGA" />
        </View>
        {!data.intervals_connected && (
          <Pressable testID="connect-intervals-cta" style={styles.connectCta} onPress={() => router.push("/settings")}>
            <Ionicons name="link-outline" size={16} color={colors.brandSecondary} />
            <Text style={styles.connectText}>Conecte o intervals.icu para importar treinos</Text>
          </Pressable>
        )}

        {/* Nutrition summary */}
        <Text style={styles.sectionTitle}>COMBUSTÍVEL · HOJE</Text>
        <View style={styles.fuelCard}>
          <FuelBar label="Calorias" value={data.calories} goal={g.calories} unit="kcal" />
          <FuelBar label="Proteína" value={data.protein} goal={g.protein} unit="g" />
          <Pressable testID="log-meal-cta" style={styles.smallBtn} onPress={() => router.push("/(tabs)/nutrition")}>
            <Ionicons name="camera" size={16} color={colors.onBrandPrimary} />
            <Text style={styles.smallBtnText}>Registrar refeição</Text>
          </Pressable>
        </View>

        {/* Water */}
        <Text style={styles.sectionTitle}>HIDRATAÇÃO</Text>
        <View style={styles.waterCard}>
          <View>
            <Text style={styles.waterNum}>{(water / 1000).toFixed(1)}<Text style={styles.waterUnit}>L</Text></Text>
            <Text style={styles.waterGoal}>meta {(g.water_ml / 1000).toFixed(1)}L</Text>
          </View>
          <View style={styles.waterBtns}>
            <Pressable testID="water-minus" style={styles.waterBtn} onPress={() => patchHabit({ water_ml: Math.max(0, water - 250) })}>
              <Ionicons name="remove" size={22} color={colors.onSurface} />
            </Pressable>
            <Pressable testID="water-plus" style={[styles.waterBtn, styles.waterBtnPrimary]} onPress={() => patchHabit({ water_ml: water + 250 })}>
              <Ionicons name="add" size={22} color={colors.onBrandPrimary} />
            </Pressable>
          </View>
        </View>

        {/* Sleep */}
        <Text style={styles.sectionTitle}>SONO</Text>
        <View style={styles.waterCard}>
          <View>
            <Text style={styles.waterNum}>{data.sleep_hours ? Number(data.sleep_hours).toFixed(1) : "0.0"}<Text style={styles.waterUnit}>h</Text></Text>
            <Text style={styles.waterGoal}>meta {g.sleep_hours}h</Text>
          </View>
          <View style={styles.waterBtns}>
            <Pressable testID="sleep-minus" style={styles.waterBtn} onPress={() => patchHabit({ sleep_hours: Math.max(0, (data.sleep_hours || 0) - 0.5) })}>
              <Ionicons name="remove" size={22} color={colors.onSurface} />
            </Pressable>
            <Pressable testID="sleep-plus" style={[styles.waterBtn, styles.waterBtnPrimary]} onPress={() => patchHabit({ sleep_hours: (data.sleep_hours || 0) + 0.5 })}>
              <Ionicons name="add" size={22} color={colors.onBrandPrimary} />
            </Pressable>
          </View>
        </View>

        {/* Discipline toggles */}
        <Text style={styles.sectionTitle}>DISCIPLINA DIÁRIA</Text>
        <View style={styles.toggleGrid}>
          <Toggle testID="toggle-meditate" icon="leaf" label="Meditar" active={data.meditate} onPress={() => patchHabit({ meditate: !data.meditate })} />
          <Toggle testID="toggle-read" icon="book" label="Ler" active={data.read} onPress={() => patchHabit({ read: !data.read })} />
          <Toggle testID="toggle-cold" icon="snow" label="Banho gelado" active={data.cold_shower} onPress={() => patchHabit({ cold_shower: !data.cold_shower })} />
        </View>

        {/* Mood + anxiety */}
        <Text style={styles.sectionTitle}>ESTADO MENTAL</Text>
        <View style={styles.moodCard}>
          <Text style={styles.moodLabel}>Humor</Text>
          <View style={styles.moodRow}>
            {MOODS.map((m, i) => (
              <Pressable
                key={i}
                testID={`mood-${i + 1}`}
                style={[styles.moodChip, data.mood === i + 1 && styles.moodChipActive]}
                onPress={() => patchHabit({ mood: i + 1 })}
              >
                <Text style={styles.moodEmoji}>{m}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.moodLabel, { marginTop: spacing.lg }]}>Ansiedade</Text>
          <View style={styles.moodRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                testID={`anxiety-${n}`}
                style={[styles.anxChip, data.anxiety === n && styles.anxChipActive]}
                onPress={() => patchHabit({ anxiety: n })}
              >
                <Text style={[styles.anxText, data.anxiety === n && styles.anxTextActive]}>{n}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: any; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function FuelBar({ label, value, goal, unit }: { label: string; value: number; goal: number; unit: string }) {
  const pct = Math.min(1, (value || 0) / Math.max(goal || 1, 1));
  return (
    <View style={{ marginBottom: spacing.md }}>
      <View style={styles.fuelHead}>
        <Text style={styles.fuelLabel}>{label}</Text>
        <Text style={styles.fuelVal}>{Math.round(value || 0)} / {goal} {unit}</Text>
      </View>
      <View style={styles.fuelTrack}>
        <View style={[styles.fuelFill, { width: `${pct * 100}%` }]} />
      </View>
    </View>
  );
}

function Toggle({ testID, icon, label, active, onPress }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.toggle, active && styles.toggleActive]}>
      <Ionicons name={icon} size={22} color={active ? colors.onBrandPrimary : colors.onSurfaceSecondary} />
      <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end",
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider,
    backgroundColor: colors.surface,
  },
  hello: { fontFamily: fonts.medium, fontSize: type.sm, color: colors.brandSecondary, letterSpacing: 3 },
  name: { fontFamily: fonts.display, fontSize: type["3xl"], color: colors.onSurface, letterSpacing: 1 },
  iconBtn: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },

  scoreCard: { alignItems: "center", paddingVertical: spacing.xl, marginTop: spacing.sm },
  scoreNum: { fontFamily: fonts.display, fontSize: 88, color: colors.onSurface, lineHeight: 92, fontVariant: ["tabular-nums"] },
  scoreLabel: { fontFamily: fonts.bold, fontSize: type.base, color: colors.brandPrimary, letterSpacing: 2, marginTop: -6 },
  streakRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.lg },
  streakText: { fontFamily: fonts.semibold, fontSize: type.base, color: colors.onSurface, letterSpacing: 1 },
  scoreCaption: { fontFamily: fonts.text, fontSize: type.sm, color: colors.onSurfaceSecondary, marginTop: spacing.xs },

  challengeCard: { backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.brandPrimary },
  challengeKicker: { fontFamily: fonts.bold, fontSize: type.sm, color: colors.brandSecondary, letterSpacing: 2, marginBottom: spacing.xs },
  challengeText: { fontFamily: fonts.medium, fontSize: type.lg, color: colors.onSurface, lineHeight: 24 },

  sectionTitle: { fontFamily: fonts.bold, fontSize: type.sm, color: colors.onSurfaceSecondary, letterSpacing: 2, marginTop: spacing.xl, marginBottom: spacing.md },

  statRow: { flexDirection: "row", gap: spacing.md },
  stat: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingVertical: spacing.lg, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  statValue: { fontFamily: fonts.display, fontSize: type["3xl"], color: colors.onSurface, fontVariant: ["tabular-nums"] },
  statLabel: { fontFamily: fonts.medium, fontSize: 10, color: colors.onSurfaceSecondary, letterSpacing: 1, marginTop: 2 },

  connectCta: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed" },
  connectText: { fontFamily: fonts.medium, fontSize: type.base, color: colors.brandSecondary },

  fuelCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  fuelHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  fuelLabel: { fontFamily: fonts.semibold, fontSize: type.base, color: colors.onSurface },
  fuelVal: { fontFamily: fonts.mono, fontSize: type.sm, color: colors.onSurfaceSecondary },
  fuelTrack: { height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  fuelFill: { height: 8, borderRadius: radius.pill, backgroundColor: colors.brandPrimary },
  smallBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brandPrimary, height: 44, borderRadius: radius.md, marginTop: spacing.sm },
  smallBtnText: { fontFamily: fonts.bold, fontSize: type.base, color: colors.onBrandPrimary },

  waterCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  waterNum: { fontFamily: fonts.display, fontSize: type["4xl"], color: colors.onSurface, fontVariant: ["tabular-nums"] },
  waterUnit: { fontFamily: fonts.display, fontSize: type.xl, color: colors.onSurfaceSecondary },
  waterGoal: { fontFamily: fonts.text, fontSize: type.sm, color: colors.onSurfaceSecondary },
  waterBtns: { flexDirection: "row", gap: spacing.sm },
  waterBtn: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  waterBtnPrimary: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },

  toggleGrid: { flexDirection: "row", gap: spacing.md },
  toggle: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingVertical: spacing.lg, alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  toggleActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  toggleText: { fontFamily: fonts.semibold, fontSize: type.sm, color: colors.onSurfaceSecondary },
  toggleTextActive: { color: colors.onBrandPrimary },

  moodCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  moodLabel: { fontFamily: fonts.semibold, fontSize: type.base, color: colors.onSurface, marginBottom: spacing.md },
  moodRow: { flexDirection: "row", gap: spacing.sm, justifyContent: "space-between" },
  moodChip: { flex: 1, aspectRatio: 1, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  moodChipActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  moodEmoji: { fontSize: 24 },
  anxChip: { flex: 1, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  anxChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  anxText: { fontFamily: fonts.bold, fontSize: type.lg, color: colors.onSurfaceSecondary },
  anxTextActive: { color: colors.onBrandPrimary },

  trainingCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.brandTertiary,
    borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.brandPrimary,
  },
  trainingLeft: { flex: 1 },
  trainingKicker: { fontFamily: fonts.bold, fontSize: 10, color: colors.brandSecondary, letterSpacing: 2 },
  trainingName: { fontFamily: fonts.display, fontSize: type.xl, color: colors.onSurface, letterSpacing: 1, marginTop: 2 },
  trainingMeta: { fontFamily: fonts.mono, fontSize: type.sm, color: colors.onSurfaceSecondary, marginTop: 2 },
  trainingRight: { marginLeft: spacing.md },
  trainingPct: { fontFamily: fonts.display, fontSize: type.base, color: colors.onSurface },
});
