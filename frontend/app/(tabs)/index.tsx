import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ProgressRing from "@/src/components/ProgressRing";
import { HeroCard, MetricCard, SectionHeader, StatTile, ErrorState, ProgressBar } from "@/src/components/ui";
import { useTheme } from "@/src/context/ThemeContext";
import { api, authHeaders, fileUrl } from "@/src/lib/api";
import { fonts, radius, spacing, type } from "@/src/theme";

function greetingLabel() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

export default function Home() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [data, setData] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [imageHeaders, setImageHeaders] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const [dashboard, activePlan] = await Promise.all([
        api.get("/dashboard"),
        api.get("/training/active"),
      ]);
      setData(dashboard);
      setPlan(activePlan?.plan || null);
      setImageHeaders(await authHeaders());
      setFailed(false);
    } catch {
      // Keep the last successfully loaded state visible; flag error if empty.
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const patchHabit = async (patch: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setData((previous: any) => ({ ...previous, ...patch }));

    try {
      await api.put("/habits", { date: data?.date, ...patch });
      await load();
    } catch {
      await load();
    }
  };

  if (!data && failed && !loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <ErrorState
          text="Não foi possível carregar seu painel. Verifique sua conexão."
          onRetry={() => { setLoading(true); load(); }}
        />
      </View>
    );
  }

  if (loading || !data) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const goals = data.goals || {};
  const score = Number(data.discipline_score || 0);
  const scoreProgress = clamp(score / 100);
  const water = Number(data.water_ml || 0);
  const waterGoal = Math.max(Number(goals.water_ml || 2000), 1);
  const activeMinutes = Number(data.active_minutes || 0);
  const activeGoal = Math.max(Number(goals.active_minutes || 30), 1);
  const calories = Number(data.calories || 0);
  const caloriesGoal = Math.max(Number(goals.calories || 700), 1);
  const firstName = String(data.name || "Atleta").split(" ")[0];
  const weeklyWorkouts = Number(data.weekly_workouts || 0);
  const weeklyKm = Number(data.weekly_km || 0);
  const streak = Number(data.streak || 0);

  const motivation =
    scoreProgress >= 0.8
      ? "Você está muito perto de fechar um dia excelente."
      : scoreProgress >= 0.5
        ? "Um bom dia já está em construção. Continue no ritmo."
        : "Consistência começa no próximo pequeno passo.";

  const riskLevel = data.overtraining?.risk_level || "indeterminado";
  const riskCopy: Record<string, string> = {
    baixo: "Carga estável",
    moderado: "Atenção à recuperação",
    alto: "Reduza intensidade",
    critico: "Priorize descanso",
    indeterminado: "Mais dados necessários",
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: 92 + insets.bottom,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        <View style={styles.page}>
          <View style={styles.header}>
            <Pressable
              testID="settings-button"
              onPress={() => router.push("/settings")}
              style={[
                styles.avatar,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              {data.avatar_url ? (
                <Image
                  source={{ uri: fileUrl(data.avatar_url), headers: imageHeaders }}
                  style={styles.avatarImg}
                  contentFit="cover"
                />
              ) : (
                <Ionicons name="person" size={20} color={colors.text} />
              )}
              <View style={[styles.onlineDot, { backgroundColor: colors.accent }]} />
            </Pressable>

            <View style={styles.headerCopy}>
              <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>
                {greetingLabel()},
              </Text>
              <Text style={[styles.name, { color: colors.text }]}>{firstName}</Text>
            </View>

            <Pressable
              onPress={() => router.push("/settings")}
              style={[
                styles.iconButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons name="notifications-outline" size={21} color={colors.text} />
              <View style={[styles.notificationDot, { backgroundColor: colors.accent }]} />
            </Pressable>
          </View>

          <HeroCard>
            <View style={styles.heroTopRow}>
              <View>
                <Text style={[styles.kicker, { color: colors.accent }]}>IRONMIND SCORE</Text>
                <Text style={[styles.heroTitle, { color: colors.text }]}>Seu dia, em equilíbrio.</Text>
              </View>
              {streak > 0 && (
                <View style={[styles.streakBadge, { backgroundColor: colors.accentMuted }]}> 
                  <Ionicons name="flame" size={14} color={colors.accent} />
                  <Text style={[styles.streakText, { color: colors.accent }]}>{streak} dias</Text>
                </View>
              )}
            </View>

            <View style={styles.heroMain}>
              <View style={styles.ringWrap} testID="discipline-score-card">
                <ProgressRing
                  size={154}
                  strokeWidth={12}
                  progress={scoreProgress}
                  color={colors.accent}
                  trackColor={colors.border}
                />
                <View style={styles.ringCenter} pointerEvents="none">
                  <Text style={[styles.score, { color: colors.text }]} testID="discipline-score-value">
                    {Math.round(score)}
                    <Text style={[styles.scorePercent, { color: colors.text }]}>%</Text>
                  </Text>
                  <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>meta diária</Text>
                </View>
              </View>

              <View style={styles.heroMessage}>
                <Text style={[styles.motivation, { color: colors.text }]}>{motivation}</Text>
                <View style={styles.primaryGoalRow}>
                  <View style={[styles.goalIcon, { backgroundColor: colors.accentMuted }]}> 
                    <Ionicons name="navigate" size={18} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.miniLabel, { color: colors.accent }]}>FOCO DE HOJE</Text>
                    <Text style={[styles.primaryGoal, { color: colors.text }]}>Mover com intenção</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={[styles.weekStrip, { borderTopColor: colors.border }]}> 
              {[
                ["S", false],
                ["T", false],
                ["Q", false],
                ["Q", true],
                ["S", false],
                ["S", false],
                ["D", false],
              ].map(([label, active], index) => (
                <View
                  key={`${label}-${index}`}
                  style={[
                    styles.dayBubble,
                    active && { backgroundColor: colors.accent },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayLabel,
                      { color: active ? colors.onAccent : colors.textSecondary },
                    ]}
                  >
                    {label}
                  </Text>
                </View>
              ))}
            </View>
          </HeroCard>

          {data.readiness && (() => {
            const rd = data.readiness;
            const tone = rd.level === "green" ? colors.accent : rd.level === "yellow" ? colors.warning : colors.error;
            const label = rd.level === "green" ? "Prontidão alta" : rd.level === "yellow" ? "Prontidão moderada" : "Prontidão baixa";
            const detail = rd.factors?.[0]?.detail || "Tudo em equilíbrio para treinar hoje.";
            return (
              <>
                <SectionHeader title="Prontidão de hoje" />
                <View style={[styles.readinessCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.readinessTop}>
                    <View style={{ flex: 1, marginRight: spacing.md }}>
                      <Text style={[styles.readinessLevel, { color: tone }]}>{label}</Text>
                      <Text style={[styles.readinessDetail, { color: colors.textSecondary }]} numberOfLines={2}>{detail}</Text>
                    </View>
                    <Text style={[styles.readinessScore, { color: colors.text }]}>
                      {Math.round(rd.score)}
                      <Text style={[styles.readinessUnit, { color: colors.textSecondary }]}>/100</Text>
                    </Text>
                  </View>
                  <ProgressBar progress={clamp(rd.score / 100)} color={tone} style={{ marginTop: spacing.lg }} />
                </View>
              </>
            );
          })()}

          <SectionHeader title="Metas de hoje" action="Editar" />
          <View style={styles.metricsRow}>
            <MetricCard
              icon="water-outline"
              label="Água"
              value={`${(water / 1000).toFixed(1)}L`}
              sub={`de ${(waterGoal / 1000).toFixed(1)}L`}
              progress={clamp(water / waterGoal)}
              onPress={() => patchHabit({ water_ml: water + 250 })}
            />
            <MetricCard
              icon="timer-outline"
              label="Ativo"
              value={`${Math.round(activeMinutes)}`}
              sub={`de ${Math.round(activeGoal)} min`}
              progress={clamp(activeMinutes / activeGoal)}
            />
            <MetricCard
              icon="flame-outline"
              label="Calorias"
              value={`${Math.round(calories)}`}
              sub={`de ${Math.round(caloriesGoal)}`}
              progress={clamp(calories / caloriesGoal)}
            />
          </View>

          {plan && plan.status !== "completed" && (
            <>
              <SectionHeader title="Próximo treino" />
              <Pressable testID="training-plan-card" onPress={() => router.push("/session")}> 
                <LinearGradient
                  colors={[colors.elevated, colors.surface]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.workoutCard, { borderColor: colors.border }]}
                >
                  <View style={styles.workoutTop}>
                    <View style={[styles.workoutIcon, { backgroundColor: colors.accentMuted }]}> 
                      <Ionicons name="fitness-outline" size={24} color={colors.accent} />
                    </View>
                    <View style={styles.workoutCopy}>
                      <Text style={[styles.miniLabel, { color: colors.accent }]}>TREINO RECOMENDADO</Text>
                      <Text style={[styles.workoutTitle, { color: colors.text }]} numberOfLines={1}>
                        {plan.program_name || "Sessão programada"}
                      </Text>
                      <Text style={[styles.workoutMeta, { color: colors.textSecondary }]}> 
                        Sessão {plan.current_session} de {plan.total_sessions}
                      </Text>
                    </View>
                    <View style={[styles.playButton, { backgroundColor: colors.accent }]}> 
                      <Ionicons name="play" size={20} color={colors.onAccent} />
                    </View>
                  </View>
                  <View style={[styles.workoutFooter, { borderTopColor: colors.border }]}> 
                    <View style={styles.workoutFooterItem}>
                      <Ionicons name="sparkles-outline" size={15} color={colors.textSecondary} />
                      <Text style={[styles.workoutFooterText, { color: colors.textSecondary }]}>Adaptado ao seu momento</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={17} color={colors.accent} />
                  </View>
                </LinearGradient>
              </Pressable>
            </>
          )}

          <SectionHeader title="Seu momento" />
          <View style={styles.insightGrid}>
            <StatTile
              icon="pulse-outline"
              label="Carga de treino"
              value={riskCopy[riskLevel] || riskCopy.indeterminado}
              supporting={data.overtraining?.recommendation || "Acompanhando sua resposta aos treinos."}
              trend="arrow-up-outline"
            />
            <StatTile
              icon="analytics-outline"
              label="Esta semana"
              value={`${weeklyWorkouts} sessões`}
              supporting={`${weeklyKm.toFixed(1)} km acumulados`}
              trend="arrow-up-outline"
            />
          </View>

          <SectionHeader title="Pequenos hábitos" />
          <View style={styles.habitRow}>
            <HabitButton
              icon="leaf-outline"
              label="Meditar"
              active={Boolean(data.meditate)}
              colors={colors}
              onPress={() => patchHabit({ meditate: !data.meditate })}
              testID="toggle-meditate"
            />
            <HabitButton
              icon="book-outline"
              label="Ler"
              active={Boolean(data.read)}
              colors={colors}
              onPress={() => patchHabit({ read: !data.read })}
              testID="toggle-read"
            />
            <HabitButton
              icon="snow-outline"
              label="Gelado"
              active={Boolean(data.cold_shower)}
              colors={colors}
              onPress={() => patchHabit({ cold_shower: !data.cold_shower })}
              testID="toggle-cold"
            />
          </View>

          {!data.intervals_connected && (
            <Pressable
              testID="connect-intervals-cta"
              onPress={() => router.push("/settings")}
              style={[styles.connectCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.connectIcon, { backgroundColor: colors.accentMuted }]}> 
                <Ionicons name="link-outline" size={19} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.connectTitle, { color: colors.text }]}>Conecte seu treino real</Text>
                <Text style={[styles.connectSubtitle, { color: colors.textSecondary }]}>intervals.icu deixa seu painel ainda mais inteligente.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function HabitButton({ icon, label, active, colors, onPress, testID }: any) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[
        styles.habitButton,
        {
          backgroundColor: active ? colors.accent : colors.surface,
          borderColor: active ? colors.accent : colors.border,
        },
      ]}
    >
      <Ionicons
        name={active ? icon.replace("-outline", "") : icon}
        size={19}
        color={active ? colors.onAccent : colors.textSecondary}
      />
      <Text
        style={[
          styles.habitText,
          { color: active ? colors.onAccent : colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  page: { paddingHorizontal: spacing.xl },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: { width: 46, height: 46, borderRadius: 23 },
  onlineDot: {
    position: "absolute",
    right: -1,
    bottom: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#101011",
  },
  headerCopy: { flex: 1, marginLeft: spacing.md },
  eyebrow: { fontFamily: fonts.text, ...type.bodySmall },
  name: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 31, marginTop: -1 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationDot: {
    position: "absolute",
    top: 9,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  kicker: {
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1.5,
  },
  heroTitle: {
    fontFamily: fonts.semibold,
    fontSize: 20,
    lineHeight: 26,
    marginTop: spacing.xs,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  streakText: { fontFamily: fonts.semibold, ...type.caption },
  heroMain: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xl,
    gap: spacing.xl,
  },
  ringWrap: {
    width: 154,
    height: 154,
    alignItems: "center",
    justifyContent: "center",
  },
  ringCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  score: {
    fontFamily: fonts.bold,
    fontSize: 40,
    lineHeight: 44,
    fontVariant: ["tabular-nums"],
  },
  scorePercent: { fontSize: 22, lineHeight: 26 },
  scoreLabel: { fontFamily: fonts.medium, ...type.caption, marginTop: 2 },
  heroMessage: { flex: 1 },
  motivation: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 23 },
  primaryGoalRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  goalIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  miniLabel: {
    fontFamily: fonts.bold,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1.15,
  },
  primaryGoal: { fontFamily: fonts.semibold, ...type.bodySmall, marginTop: 2 },
  weekStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
  },
  dayBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dayLabel: { fontFamily: fonts.semibold, ...type.caption },

  readinessCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.lg,
  },
  readinessTop: { flexDirection: "row", alignItems: "flex-start" },
  readinessLevel: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22 },
  readinessDetail: { fontFamily: fonts.text, ...type.bodySmall, marginTop: 3 },
  readinessScore: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 32, fontVariant: ["tabular-nums"] },
  readinessUnit: { fontFamily: fonts.text, ...type.bodySmall },

  metricsRow: { flexDirection: "row", gap: spacing.sm },

  workoutCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: spacing.lg,
  },
  workoutTop: { flexDirection: "row", alignItems: "center" },
  workoutIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  workoutCopy: { flex: 1, marginLeft: spacing.md, marginRight: spacing.md },
  workoutTitle: { fontFamily: fonts.bold, ...type.body, marginTop: 3 },
  workoutMeta: { fontFamily: fonts.text, ...type.bodySmall, marginTop: 2 },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  workoutFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    paddingTop: spacing.md,
    marginTop: spacing.lg,
  },
  workoutFooterItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  workoutFooterText: { fontFamily: fonts.medium, ...type.caption },

  insightGrid: { flexDirection: "row", gap: spacing.md },

  habitRow: { flexDirection: "row", gap: spacing.sm },
  habitButton: {
    flex: 1,
    height: 58,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  habitText: { fontFamily: fonts.semibold, ...type.bodySmall },

  connectCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: 22,
    borderWidth: 1,
    padding: spacing.lg,
    marginTop: spacing["3xl"],
  },
  connectIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  connectTitle: { fontFamily: fonts.semibold, ...type.bodySmall },
  connectSubtitle: { fontFamily: fonts.text, ...type.caption, marginTop: 2, lineHeight: 16 },
});
