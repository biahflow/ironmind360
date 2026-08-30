import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { spacing, radius, fonts, type } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/lib/api";
import ProgressRing from "@/src/components/ProgressRing";

function greetingLabel() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function Home() {
  const { colors } = useTheme();
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
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const g = data.goals || {};
  const water = data.water_ml || 0;
  const scorePct = (data.discipline_score || 0) / 100;
  const calPct = Math.min(1, (data.calories || 0) / Math.max(g.calories || 1, 1));
  const waterPct = Math.min(1, water / Math.max(g.water_ml || 1, 1));

  return (
    <View style={[s.root, { backgroundColor: colors.bg }]}>
      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable
          testID="settings-button"
          onPress={() => router.push("/settings")}
          style={[s.headerIcon, { borderColor: colors.border }]}
        >
          <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={[s.greetingText, { color: colors.text }]}>
            {greetingLabel()}, {(data.name || "Atleta").split(" ")[0]}
          </Text>
        </View>
        <Pressable
          style={[s.headerIcon, { borderColor: colors.border }]}
          onPress={() => router.push("/settings")}
        >
          <Ionicons name="notifications-outline" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarPad }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {/* ── Hero Progress Card ── */}
        <View style={{ paddingHorizontal: spacing["2xl"] }}>
          <View
            style={[s.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            testID="discipline-score-card"
          >
            <View style={s.heroContent}>
              <View style={s.heroLeft}>
                <Text style={[s.heroLabel, { color: colors.textSecondary }]}>
                  Seu progresso de hoje
                </Text>
                <View style={s.heroScoreRow}>
                  <Text
                    style={[s.heroScore, { color: colors.text }]}
                    testID="discipline-score-value"
                  >
                    {data.discipline_score}
                  </Text>
                  <Text style={[s.heroPct, { color: colors.accent }]}>%</Text>
                </View>
                <Text style={[s.heroMotivation, { color: colors.textSecondary }]}>
                  {scorePct >= 0.8
                    ? "Excelente ritmo. Continue assim."
                    : scorePct >= 0.5
                      ? "Bom progresso. Quase lá."
                      : "Cada passo conta. Vamos nessa."}
                </Text>
              </View>
              <ProgressRing
                size={100}
                strokeWidth={10}
                progress={scorePct}
                color={colors.accent}
                trackColor={colors.border}
              />
            </View>
            {data.streak > 0 && (
              <View style={[s.streakRow, { borderTopColor: colors.border }]}>
                <Ionicons name="flame-outline" size={14} color={colors.accent} />
                <Text style={[s.streakText, { color: colors.textSecondary }]}>
                  {data.streak} dias seguidos
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Daily Goals ── */}
        <View style={s.goalsSection}>
          <View style={s.goalRow}>
            <DailyGoalCard
              icon="water-outline"
              label="Água"
              value={`${(water / 1000).toFixed(1)}L`}
              pct={waterPct}
              colors={colors}
              onPlus={() => patchHabit({ water_ml: water + 250 })}
            />
            <DailyGoalCard
              icon="time-outline"
              label="Minutos ativos"
              value={`${Math.round(data.active_minutes || 0)}`}
              pct={Math.min(1, (data.active_minutes || 0) / Math.max(g.active_minutes || 30, 1))}
              colors={colors}
            />
            <DailyGoalCard
              icon="flame-outline"
              label="Calorias"
              value={`${Math.round(data.calories || 0)}`}
              pct={calPct}
              colors={colors}
            />
          </View>
        </View>

        {/* ── Training Load Risk ── */}
        {data.overtraining && (
          <View style={{ paddingHorizontal: spacing["2xl"], marginTop: spacing["2xl"] }}>
            <TrainingLoadCard risk={data.overtraining} colors={colors} />
          </View>
        )}

        {/* ── Session Anomalies ── */}
        {data.anomalies && data.anomalies.anomaly_count > 0 && (
          <View style={{ paddingHorizontal: spacing["2xl"], marginTop: spacing["2xl"] }}>
            <AnomalyCard anomalies={data.anomalies} colors={colors} />
          </View>
        )}

        {/* ── Next Workout ── */}
        {plan && plan.status !== "completed" && (
          <View style={{ paddingHorizontal: spacing["2xl"], marginTop: spacing["2xl"] }}>
            <Pressable
              testID="training-plan-card"
              style={[s.workoutCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push("/session")}
            >
              <View style={s.workoutLeft}>
                <Text style={[s.workoutKicker, { color: colors.textSecondary }]}>
                  PRÓXIMO TREINO
                </Text>
                <Text style={[s.workoutName, { color: colors.text }]} numberOfLines={1}>
                  {plan.program_name}
                </Text>
                <Text style={[s.workoutMeta, { color: colors.textSecondary }]}>
                  Sessão {plan.current_session} de {plan.total_sessions}
                </Text>
              </View>
              <View style={[s.workoutPlayBtn, { backgroundColor: colors.accent }]}>
                <Ionicons name="play" size={18} color={colors.onAccent} />
              </View>
            </Pressable>
          </View>
        )}

        {/* ── Explore / Editorial ── */}
        <View style={{ paddingHorizontal: spacing["2xl"], marginTop: spacing["3xl"] }}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>Explorar</Text>
          <View style={s.exploreGrid}>
            <ExploreCard
              title="Dica de nutrição"
              subtitle={data.daily_challenge || "Alimente seu treino"}
              colors={colors}
              icon="nutrition-outline"
            />
            <ExploreCard
              title="Esta semana"
              subtitle={`${data.weekly_workouts || 0} sessões · ${data.weekly_km || 0} km`}
              colors={colors}
              icon="stats-chart-outline"
            />
          </View>
        </View>

        {/* ── Habits ── */}
        <View style={{ paddingHorizontal: spacing["2xl"], marginTop: spacing["3xl"] }}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>Hábitos</Text>
          <View style={s.habitRow}>
            <HabitPill
              testID="toggle-meditate"
              icon="leaf-outline"
              label="Meditar"
              active={data.meditate}
              onPress={() => patchHabit({ meditate: !data.meditate })}
              colors={colors}
            />
            <HabitPill
              testID="toggle-read"
              icon="book-outline"
              label="Ler"
              active={data.read}
              onPress={() => patchHabit({ read: !data.read })}
              colors={colors}
            />
            <HabitPill
              testID="toggle-cold"
              icon="snow-outline"
              label="Gelado"
              active={data.cold_shower}
              onPress={() => patchHabit({ cold_shower: !data.cold_shower })}
              colors={colors}
            />
          </View>
        </View>

        {/* ── Connect CTA ── */}
        {!data.intervals_connected && (
          <View style={{ paddingHorizontal: spacing["2xl"], marginTop: spacing["2xl"] }}>
            <Pressable
              testID="connect-intervals-cta"
              style={[s.connectCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push("/settings")}
            >
              <Ionicons name="link-outline" size={16} color={colors.textSecondary} />
              <Text style={[s.connectText, { color: colors.textSecondary }]}>
                Conectar intervals.icu
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* ── Sub-components ── */

const RISK_META: Record<string, { label: string; key: "success" | "warning" | "error" | "textSecondary" }> = {
  baixo: { label: "Baixo", key: "success" },
  moderado: { label: "Moderado", key: "warning" },
  alto: { label: "Alto", key: "error" },
  critico: { label: "Crítico", key: "error" },
  indeterminado: { label: "Sem dados", key: "textSecondary" },
};

function TrainingLoadCard({ risk, colors }: any) {
  const meta = RISK_META[risk.risk_level] || RISK_META.indeterminado;
  const tint = colors[meta.key];
  const isIndeterminate = risk.risk_level === "indeterminado";
  return (
    <View style={[s.loadCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={s.loadHeader}>
        <View style={s.loadTitleRow}>
          <Ionicons name="pulse-outline" size={18} color={colors.textSecondary} />
          <Text style={[s.loadTitle, { color: colors.text }]}>Carga de treino</Text>
        </View>
        <View style={[s.loadPill, { backgroundColor: tint + "22" }]}>
          <View style={[s.loadDot, { backgroundColor: tint }]} />
          <Text style={[s.loadPillText, { color: tint }]}>{meta.label}</Text>
        </View>
      </View>

      {isIndeterminate ? (
        <Text style={[s.loadRec, { color: colors.textSecondary }]}>
          {risk.recommendation || "Registre treinos para estimar sua carga."}
        </Text>
      ) : (
        <>
          <View style={s.loadMetrics}>
            {risk.acwr != null && (
              <View style={s.loadMetric}>
                <Text style={[s.loadMetricValue, { color: colors.text }]}>{risk.acwr}</Text>
                <Text style={[s.loadMetricLabel, { color: colors.textSecondary }]}>ACWR</Text>
              </View>
            )}
            {risk.risk_score != null && (
              <View style={s.loadMetric}>
                <Text style={[s.loadMetricValue, { color: colors.text }]}>{risk.risk_score}</Text>
                <Text style={[s.loadMetricLabel, { color: colors.textSecondary }]}>Score</Text>
              </View>
            )}
            {risk.monotony != null && (
              <View style={s.loadMetric}>
                <Text style={[s.loadMetricValue, { color: colors.text }]}>{risk.monotony}</Text>
                <Text style={[s.loadMetricLabel, { color: colors.textSecondary }]}>Monotonia</Text>
              </View>
            )}
          </View>
          {risk.recommendation && (
            <Text style={[s.loadRec, { color: colors.textSecondary }]}>{risk.recommendation}</Text>
          )}
        </>
      )}
    </View>
  );
}

const ANOMALY_CLASS: Record<string, { label: string; icon: string; key: "success" | "warning" | "error" }> = {
  positiva: { label: "Positiva", icon: "trending-up-outline", key: "success" },
  negativa: { label: "Negativa", icon: "trending-down-outline", key: "error" },
  neutra: { label: "Neutra", icon: "swap-horizontal-outline", key: "warning" },
};

function AnomalyCard({ anomalies, colors }: any) {
  const items: any[] = anomalies.anomalies || [];
  const count = items.length;
  return (
    <View style={[s.loadCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={s.loadHeader}>
        <View style={s.loadTitleRow}>
          <Ionicons name="analytics-outline" size={18} color={colors.textSecondary} />
          <Text style={[s.loadTitle, { color: colors.text }]}>Sessões atípicas</Text>
        </View>
        <View style={[s.loadPill, { backgroundColor: colors.warning + "22" }]}>
          <Text style={[s.loadPillText, { color: colors.warning }]}>{count}</Text>
        </View>
      </View>
      {items.slice(0, 3).map((a: any, i: number) => {
        const meta = ANOMALY_CLASS[a.classification] || ANOMALY_CLASS.neutra;
        const tint = colors[meta.key];
        return (
          <View
            key={a.icu_id || i}
            style={[s.anomalyItem, { borderTopColor: colors.border }]}
          >
            <Ionicons name={meta.icon as any} size={16} color={tint} />
            <View style={s.anomalyContent}>
              <Text style={[s.anomalyName, { color: colors.text }]} numberOfLines={1}>
                {a.activity_name || a.activity_type}
              </Text>
              <Text style={[s.anomalySummary, { color: colors.textSecondary }]} numberOfLines={2}>
                {a.summary}
              </Text>
            </View>
            <View style={[s.loadPill, { backgroundColor: tint + "22" }]}>
              <Text style={[s.loadPillText, { color: tint }]}>{meta.label}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function DailyGoalCard({ icon, label, value, pct, colors, onPlus }: any) {
  return (
    <Pressable
      style={[s.goalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPlus}
    >
      <Ionicons name={icon} size={18} color={colors.textSecondary} />
      <Text style={[s.goalValue, { color: colors.text }]}>{value}</Text>
      <Text style={[s.goalLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View style={[s.goalTrack, { backgroundColor: colors.border }]}>
        <View
          style={[
            s.goalFill,
            {
              width: `${Math.round(Math.min(pct, 1) * 100)}%`,
              backgroundColor: pct >= 1 ? colors.accent : colors.textSecondary,
            },
          ]}
        />
      </View>
    </Pressable>
  );
}

function ExploreCard({ title, subtitle, colors, icon }: any) {
  return (
    <View style={[s.exploreCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[s.exploreIconWrap, { backgroundColor: colors.elevated }]}>
        <Ionicons name={icon} size={20} color={colors.textSecondary} />
      </View>
      <Text style={[s.exploreTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[s.exploreSub, { color: colors.textSecondary }]} numberOfLines={2}>
        {subtitle}
      </Text>
    </View>
  );
}

function HabitPill({ testID, icon, label, active, onPress, colors }: any) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[
        s.habitChip,
        {
          backgroundColor: active ? colors.accent : colors.surface,
          borderColor: active ? colors.accent : colors.border,
        },
      ]}
    >
      <Ionicons
        name={active ? icon.replace("-outline", "") : icon}
        size={18}
        color={active ? colors.onAccent : colors.textSecondary}
      />
      <Text
        style={[
          s.habitLabel,
          { color: active ? colors.onAccent : colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* ── Styles ── */

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing["2xl"],
    paddingBottom: spacing.xl,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  greetingText: {
    fontFamily: fonts.semibold,
    ...type.body,
  },

  // Hero
  heroCard: {
    borderRadius: radius.xl,
    padding: spacing["2xl"],
    borderWidth: 1,
  },
  heroContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroLeft: { flex: 1, marginRight: spacing.lg },
  heroLabel: {
    fontFamily: fonts.medium,
    ...type.bodySmall,
  },
  heroScoreRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: spacing.sm,
  },
  heroScore: {
    fontFamily: fonts.bold,
    fontSize: 56,
    lineHeight: 60,
    fontVariant: ["tabular-nums"],
  },
  heroPct: {
    fontFamily: fonts.bold,
    ...type.h2,
    marginBottom: 8,
    marginLeft: 2,
  },
  heroMotivation: {
    fontFamily: fonts.text,
    ...type.bodySmall,
    marginTop: spacing.sm,
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
  },
  streakText: {
    fontFamily: fonts.medium,
    ...type.bodySmall,
  },

  // Goals
  goalsSection: {
    paddingHorizontal: spacing["2xl"],
    marginTop: spacing["2xl"],
  },
  goalRow: { flexDirection: "row", gap: spacing.md },
  goalCard: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    gap: spacing.xs,
  },
  goalValue: {
    fontFamily: fonts.bold,
    ...type.metric,
    fontVariant: ["tabular-nums"],
    marginTop: spacing.sm,
  },
  goalLabel: {
    fontFamily: fonts.medium,
    ...type.caption,
  },
  goalTrack: {
    height: 3,
    borderRadius: radius.pill,
    width: "100%",
    overflow: "hidden",
    marginTop: spacing.sm,
  },
  goalFill: { height: 3, borderRadius: radius.pill },

  // Training load
  loadCard: {
    borderRadius: radius.xl,
    padding: spacing["2xl"],
    borderWidth: 1,
  },
  loadHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  loadTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  loadTitle: { fontFamily: fonts.semibold, ...type.body },
  loadPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  loadDot: { width: 8, height: 8, borderRadius: 4 },
  loadPillText: { fontFamily: fonts.semibold, ...type.caption },
  loadMetrics: { flexDirection: "row", gap: spacing["2xl"], marginTop: spacing.lg },
  loadMetric: {},
  loadMetricValue: {
    fontFamily: fonts.bold,
    ...type.metric,
    fontVariant: ["tabular-nums"],
  },
  loadMetricLabel: { fontFamily: fonts.medium, ...type.caption, marginTop: 2 },
  loadRec: {
    fontFamily: fonts.text,
    ...type.bodySmall,
    marginTop: spacing.lg,
    lineHeight: 20,
  },

  // Anomalies
  anomalyItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingTop: spacing.lg,
    marginTop: spacing.lg,
    borderTopWidth: 1,
  },
  anomalyContent: { flex: 1 },
  anomalyName: {
    fontFamily: fonts.semibold,
    ...type.bodySmall,
  },
  anomalySummary: {
    fontFamily: fonts.text,
    ...type.caption,
    marginTop: 2,
  },

  // Workout
  workoutCard: {
    borderRadius: radius.xl,
    padding: spacing["2xl"],
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  workoutLeft: { flex: 1 },
  workoutKicker: {
    fontFamily: fonts.semibold,
    ...type.caption,
    letterSpacing: 1.5,
  },
  workoutName: {
    fontFamily: fonts.bold,
    ...type.h2,
    marginTop: spacing.xs,
  },
  workoutMeta: {
    fontFamily: fonts.text,
    ...type.bodySmall,
    marginTop: spacing.xs,
  },
  workoutPlayBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },

  // Section title
  sectionTitle: {
    fontFamily: fonts.bold,
    ...type.h2,
    marginBottom: spacing.lg,
  },

  // Explore
  exploreGrid: { flexDirection: "row", gap: spacing.md },
  exploreCard: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
  },
  exploreIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  exploreTitle: {
    fontFamily: fonts.semibold,
    ...type.body,
  },
  exploreSub: {
    fontFamily: fonts.text,
    ...type.bodySmall,
    marginTop: spacing.xs,
  },

  // Habits
  habitRow: { flexDirection: "row", gap: spacing.md },
  habitChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  habitLabel: {
    fontFamily: fonts.semibold,
    ...type.bodySmall,
  },

  // Connect
  connectCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  connectText: {
    flex: 1,
    fontFamily: fonts.medium,
    ...type.bodySmall,
  },
});
