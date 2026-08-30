import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
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
import { LineTrend } from "@/src/components/LineTrend";
import {
  HeroCard, MetricCard, SectionHeader, StatTile, ErrorState, ProgressBar,
  FadeInView, SkeletonCard, Skeleton, PressableScale,
} from "@/src/components/ui";
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

function fmtShortDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

// Semáforo de cores dos tiles: cinza = sem dado, verde = ok, laranja = perto do
// limite, vermelho = fora do recomendado.
function goalTone(value: number, goal: number, colors: any): string {
  if (!value) return colors.textSecondary;
  const p = value / Math.max(goal, 1);
  if (p >= 0.7) return colors.accent;
  if (p >= 0.3) return colors.warning;
  return colors.error;
}
function restingHrTone(bpm: number | null | undefined, colors: any): string {
  if (bpm == null) return colors.textSecondary;
  if (bpm <= 60) return colors.accent;
  if (bpm <= 75) return colors.warning;
  return colors.error;
}
function sleepTone(hours: number | null | undefined, colors: any): string {
  if (hours == null) return colors.textSecondary;
  if (hours >= 7 && hours <= 9) return colors.accent; // ideal
  if (hours < 6) return colors.error; // pouco sono prejudica treino/recuperação
  return colors.warning; // 6–7h ou dormir demais (>9h): só alerta, nunca vermelho
}

// Dias até a data (>= 0). null se inválida/passada.
function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const target = new Date(iso + (iso.length <= 10 ? "T00:00:00" : ""));
  if (isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - today.getTime()) / 86400000);
  return diff < 0 ? null : diff;
}

// Escolhe a próxima prova-alvo: prioridade A futura mais próxima; senão,
// qualquer prova futura mais próxima.
function pickTargetRace(races: any[]): any | null {
  const future = (races || [])
    .map((r) => ({ r, d: daysUntil(r.date) }))
    .filter((x) => x.d != null)
    .sort((a, b) => (a.d as number) - (b.d as number));
  if (future.length === 0) return null;
  const aRace = future.find((x) => x.r.priority === "A");
  return (aRace || future[0]).r;
}

// Deriva um alerta proativo do Comandante a partir de readiness / overtraining.
function proactiveInsight(data: any): { title: string; body: string; tone: "warning" | "error" } | null {
  const risk = data?.overtraining?.risk_level;
  if (risk === "critico" || risk === "alto") {
    return {
      title: "O Comandante notou sua carga subindo",
      body: risk === "critico"
        ? "Sinais de sobrecarga. Priorize descanso hoje — vamos ajustar o plano?"
        : "Recuperação pedindo atenção. Bora revisar a intensidade da semana?",
      tone: risk === "critico" ? "error" : "warning",
    };
  }
  const rd = data?.readiness;
  if (rd?.level === "red") {
    const f = rd.factors?.find((x: any) => x.impact === "red") || rd.factors?.[0];
    return {
      title: "Sua prontidão está baixa hoje",
      body: f?.detail ? `${f.detail} Quer conversar sobre como ajustar o dia?` : "Quer conversar sobre como ajustar o dia?",
      tone: "error",
    };
  }
  return null;
}

export default function Home() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [data, setData] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [wearable, setWearable] = useState<any>(null);
  const [habitsWeek, setHabitsWeek] = useState<any>(null);
  const [races, setRaces] = useState<any[]>([]);
  const [factorsOpen, setFactorsOpen] = useState(false);
  const [chart, setChart] = useState<null | {
    metric: "resting_hr" | "sleep";
    loading: boolean;
    points: { date: string; value: number }[];
  }>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [imageHeaders, setImageHeaders] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const [dashboard, activePlan, wearableSummary, week, raceList] = await Promise.all([
        api.get("/dashboard"),
        api.get("/training/active"),
        // Best-effort: sem wearable conectado o endpoint pode falhar; não deve
        // derrubar o carregamento do painel.
        api.get("/wearable-summary").catch(() => null),
        api.get("/habits/week").catch(() => null),
        api.get("/races").catch(() => null),
      ]);
      setData(dashboard);
      setPlan(activePlan?.plan || null);
      setWearable(wearableSummary);
      setHabitsWeek(week);
      setRaces(Array.isArray(raceList) ? raceList : raceList?.races || []);
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

  const openChart = async (metric: "resting_hr" | "sleep") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setChart({ metric, loading: true, points: [] });
    const from = new Date();
    from.setDate(from.getDate() - 7);
    const dateFrom = from.toISOString().slice(0, 10);
    try {
      const res = await api.get(
        `/wearable-data?data_type=${metric}&date_from=${dateFrom}&limit=7`,
      );
      const key = metric === "resting_hr" ? "bpm" : "hours";
      // O endpoint devolve em ordem decrescente; invertemos para cronológica.
      const points = (res?.data || [])
        .map((d: any) => ({ date: d.date, value: Number(d.value?.[key]) }))
        .filter((p: any) => !isNaN(p.value))
        .reverse();
      setChart({ metric, loading: false, points });
    } catch {
      setChart({ metric, loading: false, points: [] });
    }
  };

  const toggleHabit = async (habit: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const today = habitsWeek?.days?.[habitsWeek.days.length - 1] || data?.date;
    const next = !habit.done_today;
    try {
      if (habit.builtin) {
        await api.put("/habits", { date: today, [habit.key]: next });
      } else {
        await api.put(`/custom-habits/${habit.id}/log`, { date: today, value: next ? 1 : 0 });
      }
      await load();
    } catch {
      await load();
    }
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
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <View style={[styles.page, { paddingTop: insets.top + spacing.lg, gap: spacing.lg }]}>
          <View style={styles.header}>
            <Skeleton width={46} height={46} radius={23} />
            <View style={{ flex: 1, marginLeft: spacing.md, gap: 6 }}>
              <Skeleton width="40%" height={12} />
              <Skeleton width="55%" height={22} />
            </View>
          </View>
          <SkeletonCard lines={4} />
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <SkeletonCard lines={2} style={{ flex: 1 }} />
            <SkeletonCard lines={2} style={{ flex: 1 }} />
            <SkeletonCard lines={2} style={{ flex: 1 }} />
          </View>
          <SkeletonCard lines={3} />
        </View>
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

  // Semana real: cada dia "conta" na corrente se algum hábito foi cumprido.
  const weekDays: string[] = habitsWeek?.days || [];
  const chainDays: boolean[] = weekDays.map((_, i) =>
    (habitsWeek?.habits || []).some((h: any) => h.week?.[i]),
  );
  const dayLetters = ["D", "S", "T", "Q", "Q", "S", "S"];
  const todayIdx = weekDays.length - 1;

  // Prova-alvo + contagem regressiva.
  const targetRace = pickTargetRace(races);
  const raceDays = targetRace ? daysUntil(targetRace.date) : null;

  // Alerta proativo do Comandante.
  const insight = proactiveInsight(data);

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
              accessibilityRole="button"
              accessibilityLabel="Abrir configurações"
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
              accessibilityRole="button"
              accessibilityLabel="Notificações"
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
              {(weekDays.length ? weekDays : [0, 1, 2, 3, 4, 5, 6]).map((val, index) => {
                const isToday = index === todayIdx;
                const kept = chainDays[index];
                const letter = weekDays.length
                  ? dayLetters[new Date(String(val) + "T00:00:00").getDay()]
                  : dayLetters[index];
                return (
                  <View
                    key={`${val}-${index}`}
                    style={[
                      styles.dayBubble,
                      kept && { backgroundColor: colors.accent },
                      isToday && !kept && { borderWidth: 1.5, borderColor: colors.accent },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayLabel,
                        { color: kept ? colors.onAccent : isToday ? colors.accent : colors.textSecondary },
                      ]}
                    >
                      {letter}
                    </Text>
                  </View>
                );
              })}
            </View>
            {streak > 0 && (
              <Text style={[styles.chainHint, { color: colors.textSecondary }]}>
                🔥 {streak} {streak === 1 ? "dia" : "dias"} em sequência — não quebre a corrente.
              </Text>
            )}
          </HeroCard>

          {insight && (
            <FadeInView delay={60}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push({ pathname: "/(tabs)/coach", params: { prompt: insight.body } });
                }}
                style={[
                  styles.insightCard,
                  {
                    backgroundColor: insight.tone === "error" ? colors.errorMuted : colors.warningMuted,
                    borderColor: insight.tone === "error" ? colors.error : colors.warning,
                  },
                ]}
              >
                <View style={[styles.insightIcon, { backgroundColor: colors.surface }]}>
                  <Ionicons name="sparkles" size={18} color={insight.tone === "error" ? colors.error : colors.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.insightTitle, { color: colors.text }]}>{insight.title}</Text>
                  <Text style={[styles.insightBody, { color: colors.textSecondary }]} numberOfLines={3}>{insight.body}</Text>
                  <Text style={[styles.insightCta, { color: insight.tone === "error" ? colors.error : colors.warning }]}>
                    Falar com o Comandante ›
                  </Text>
                </View>
              </Pressable>
            </FadeInView>
          )}

          {targetRace && raceDays != null && (
            <FadeInView delay={90}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({
                    pathname: "/race-detail",
                    params: { id: targetRace.id, name: targetRace.name, type: targetRace.race_type, date: targetRace.date },
                  });
                }}
                style={[styles.raceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={[styles.raceCountBox, { backgroundColor: colors.accentMuted }]}>
                  <Text style={[styles.raceCountNum, { color: colors.accent }]}>{raceDays}</Text>
                  <Text style={[styles.raceCountUnit, { color: colors.accent }]}>{raceDays === 1 ? "dia" : "dias"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.miniLabel, { color: colors.accent }]}>
                    {targetRace.priority === "A" ? "PROVA-ALVO" : "PRÓXIMA PROVA"}
                  </Text>
                  <Text style={[styles.raceCardName, { color: colors.text }]} numberOfLines={1}>{targetRace.name}</Text>
                  <Text style={[styles.raceCardMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                    {fmtShortDate(targetRace.date)}{targetRace.goal ? ` · ${targetRace.goal}` : ""}
                  </Text>
                </View>
                <Ionicons name="flag" size={18} color={colors.textSecondary} />
              </Pressable>
            </FadeInView>
          )}

          {data.readiness && (() => {
            const rd = data.readiness;
            const tone = rd.level === "green" ? colors.accent : rd.level === "yellow" ? colors.warning : colors.error;
            const label = rd.level === "green" ? "Prontidão alta" : rd.level === "yellow" ? "Prontidão moderada" : "Prontidão baixa";
            const detail = rd.factors?.[0]?.detail || "Tudo em equilíbrio para treinar hoje.";
            return (
              <>
                <SectionHeader title="Prontidão de hoje" />
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setFactorsOpen(true);
                  }}
                  style={[styles.readinessCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
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
                  <View style={styles.readinessWhy}>
                    <Ionicons name="help-circle-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.readinessWhyText, { color: colors.textSecondary }]}>Por que este score?</Text>
                  </View>
                </Pressable>
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
              iconColor={goalTone(water, waterGoal, colors)}
              onPress={() => patchHabit({ water_ml: water + 250 })}
            />
            <MetricCard
              icon="timer-outline"
              label="Ativo"
              value={`${Math.round(activeMinutes)}`}
              sub={`de ${Math.round(activeGoal)} min`}
              progress={clamp(activeMinutes / activeGoal)}
              iconColor={goalTone(activeMinutes, activeGoal, colors)}
            />
            <MetricCard
              icon="flame-outline"
              label="Calorias"
              value={`${Math.round(calories)}`}
              sub={`de ${Math.round(caloriesGoal)}`}
              progress={clamp(calories / caloriesGoal)}
              iconColor={goalTone(calories, caloriesGoal, colors)}
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

          {(wearable?.resting_hr || wearable?.last_sleep) && (
            <>
              <SectionHeader title="Saúde" />
              <View style={styles.insightGrid}>
                {wearable?.resting_hr ? (
                  <PressableScale style={{ flex: 1 }} onPress={() => openChart("resting_hr")}>
                    <StatTile
                      icon="heart-outline"
                      label="FC repouso"
                      value={`${wearable.resting_hr.value?.bpm ?? "—"} bpm`}
                      supporting={`${fmtShortDate(wearable.resting_hr.date)} · ver 7 dias`}
                      trend="chevron-forward-outline"
                      iconColor={restingHrTone(wearable.resting_hr.value?.bpm, colors)}
                    />
                  </PressableScale>
                ) : null}
                {wearable?.last_sleep ? (
                  <PressableScale style={{ flex: 1 }} onPress={() => openChart("sleep")}>
                    <StatTile
                      icon="moon-outline"
                      label="Sono"
                      value={`${wearable.last_sleep.value?.hours ?? "—"}h`}
                      supporting={`${fmtShortDate(wearable.last_sleep.date)} · ver 7 dias`}
                      trend="chevron-forward-outline"
                      iconColor={sleepTone(wearable.last_sleep.value?.hours, colors)}
                    />
                  </PressableScale>
                ) : null}
              </View>
            </>
          )}

          <SectionHeader
            title="Pequenos hábitos"
            action="Gerenciar"
            onAction={() => router.push("/habits")}
          />
          <View style={[styles.habitList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {(habitsWeek?.habits || []).map((h: any, idx: number) => (
              <HabitRow
                key={h.key}
                habit={h}
                colors={colors}
                first={idx === 0}
                onToggle={() => toggleHabit(h)}
              />
            ))}
            {(!habitsWeek || habitsWeek.habits?.length === 0) && (
              <Text style={[styles.habitEmpty, { color: colors.textSecondary }]}>
                Toque em Gerenciar para criar seus hábitos.
              </Text>
            )}
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

      <Modal
        visible={!!chart}
        transparent
        animationType="slide"
        onRequestClose={() => setChart(null)}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setChart(null)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.xl }]}
            onPress={(e) => e.stopPropagation()}
          >
            {chart && (() => {
              const isHr = chart.metric === "resting_hr";
              const unit = isHr ? "bpm" : "h";
              const title = isHr ? "FC de repouso" : "Sono";
              const vals = chart.points.map((p) => p.value);
              const min = vals.length ? Math.min(...vals) : 0;
              const max = vals.length ? Math.max(...vals) : 0;
              const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
              const fmt = (n: number) => (isHr ? Math.round(n).toString() : n.toFixed(1));
              return (
                <>
                  <View style={styles.sheetHandle} />
                  <View style={styles.sheetHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.miniLabel, { color: colors.accent }]}>ÚLTIMOS 7 DIAS</Text>
                      <Text style={[styles.sheetTitle, { color: colors.text }]}>{title}</Text>
                    </View>
                    <Pressable
                      onPress={() => setChart(null)}
                      style={[styles.iconButton, { backgroundColor: colors.elevated, borderColor: colors.border }]}
                    >
                      <Ionicons name="close" size={20} color={colors.text} />
                    </Pressable>
                  </View>

                  {chart.loading ? (
                    <View style={styles.sheetEmpty}><ActivityIndicator color={colors.accent} /></View>
                  ) : chart.points.length === 0 ? (
                    <Text style={[styles.sheetEmptyText, { color: colors.textSecondary }]}>
                      Ainda sem dados suficientes destes 7 dias. Conforme o intervals.icu sincroniza, o gráfico aparece aqui.
                    </Text>
                  ) : (
                    <>
                      <View style={{ marginTop: spacing.lg }}>
                        <LineTrend points={chart.points} colors={colors} height={130} />
                      </View>
                      <View style={styles.sheetStats}>
                        {[["Mín", min], ["Média", avg], ["Máx", max]].map(([label, v]) => (
                          <View key={String(label)} style={styles.sheetStat}>
                            <Text style={[styles.sheetStatValue, { color: colors.text }]}>
                              {fmt(v as number)}<Text style={styles.sheetStatUnit}> {unit}</Text>
                            </Text>
                            <Text style={[styles.sheetStatLabel, { color: colors.textSecondary }]}>{label as string}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={factorsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFactorsOpen(false)}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setFactorsOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.xl }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.miniLabel, { color: colors.accent }]}>TRANSPARÊNCIA</Text>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>Por que este score?</Text>
              </View>
              <Pressable
                onPress={() => setFactorsOpen(false)}
                style={[styles.iconButton, { backgroundColor: colors.elevated, borderColor: colors.border }]}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>

            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              {(data.readiness?.factors || []).length === 0 ? (
                <Text style={[styles.sheetEmptyText, { color: colors.textSecondary }]}>
                  Sem fatores relevantes hoje — nada puxando seu score pra baixo. Continue registrando check-ins para mais detalhes.
                </Text>
              ) : (
                (data.readiness.factors || []).map((f: any, i: number) => {
                  const c = f.impact === "red" ? colors.error : f.impact === "yellow" ? colors.warning : colors.accent;
                  return (
                    <View key={i} style={[styles.factorRow, { borderColor: colors.border }]}>
                      <View style={[styles.factorDot, { backgroundColor: c }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.factorArea, { color: colors.text }]}>{String(f.area || "").toUpperCase()}</Text>
                        <Text style={[styles.factorDetail, { color: colors.textSecondary }]}>{f.detail}</Text>
                      </View>
                    </View>
                  );
                })
              )}
              <Text style={[styles.factorDisclaimer, { color: colors.textSecondary }]}>
                Estimativa de prontidão, não um diagnóstico. Sempre uma leitura de risco, nunca uma certeza.
              </Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function HabitRow({ habit, colors, first, onToggle }: any) {
  const done = habit.done_today;
  const week: boolean[] = habit.week || [];
  return (
    <Pressable
      onPress={onToggle}
      style={[styles.habitRowItem, !first && { borderTopWidth: 1, borderTopColor: colors.border }]}
    >
      <View
        style={[
          styles.habitRowIcon,
          { backgroundColor: done ? colors.accent : colors.elevated },
        ]}
      >
        <Ionicons
          name={done ? habit.icon.replace("-outline", "") : habit.icon}
          size={18}
          color={done ? colors.onAccent : colors.textSecondary}
        />
      </View>
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <Text style={[styles.habitRowName, { color: colors.text }]} numberOfLines={1}>
          {habit.name}
        </Text>
        <View style={styles.habitDots}>
          {week.map((d, i) => (
            <View
              key={i}
              style={[
                styles.habitDot,
                {
                  backgroundColor: d ? colors.accent : "transparent",
                  borderColor: d ? colors.accent : colors.border,
                },
              ]}
            />
          ))}
        </View>
      </View>
      {habit.streak > 0 && (
        <View style={styles.habitStreak}>
          <Ionicons name="flame" size={13} color={colors.accent} />
          <Text style={[styles.habitStreakText, { color: colors.accent }]}>{habit.streak}</Text>
        </View>
      )}
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
  chainHint: { fontFamily: fonts.medium, ...type.caption, marginTop: spacing.md, textAlign: "center" },

  insightCard: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  insightIcon: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center",
  },
  insightTitle: { fontFamily: fonts.bold, ...type.body },
  insightBody: { fontFamily: fonts.text, ...type.bodySmall, marginTop: 3, lineHeight: 19 },
  insightCta: { fontFamily: fonts.semibold, ...type.bodySmall, marginTop: spacing.sm },

  raceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  raceCountBox: {
    width: 62, height: 62, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  raceCountNum: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 26, fontVariant: ["tabular-nums"] },
  raceCountUnit: { fontFamily: fonts.semibold, ...type.caption, marginTop: -1 },
  raceCardName: { fontFamily: fonts.bold, ...type.body, marginTop: 3 },
  raceCardMeta: { fontFamily: fonts.text, ...type.bodySmall, marginTop: 2 },

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
  readinessWhy: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: spacing.md },
  readinessWhyText: { fontFamily: fonts.medium, ...type.caption },

  factorRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, paddingVertical: spacing.sm },
  factorDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  factorArea: { fontFamily: fonts.bold, fontSize: 10, lineHeight: 13, letterSpacing: 1 },
  factorDetail: { fontFamily: fonts.text, ...type.bodySmall, marginTop: 2, lineHeight: 19 },
  factorDisclaimer: { fontFamily: fonts.text, ...type.caption, fontStyle: "italic", marginTop: spacing.md, lineHeight: 16 },

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

  habitList: {
    borderRadius: radius.card,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
  },
  habitEmpty: {
    fontFamily: fonts.text, ...type.bodySmall,
    textAlign: "center", paddingVertical: spacing.xl,
  },
  habitRowItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  habitRowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  habitRowName: { fontFamily: fonts.semibold, ...type.bodySmall },
  habitDots: { flexDirection: "row", gap: 5, marginTop: 6 },
  habitDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  habitStreak: { flexDirection: "row", alignItems: "center", gap: 3, marginLeft: spacing.sm },
  habitStreakText: { fontFamily: fonts.bold, ...type.bodySmall, fontVariant: ["tabular-nums"] },

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

  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(128,128,128,0.4)",
    marginBottom: spacing.lg,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center" },
  sheetTitle: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 26, marginTop: 2 },
  sheetEmpty: { paddingVertical: spacing["3xl"], alignItems: "center" },
  sheetEmptyText: {
    fontFamily: fonts.text, ...type.bodySmall,
    marginTop: spacing.xl, lineHeight: 20,
  },
  sheetStats: {
    flexDirection: "row",
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.2)",
  },
  sheetStat: { flex: 1, alignItems: "center" },
  sheetStatValue: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 26, fontVariant: ["tabular-nums"] },
  sheetStatUnit: { fontFamily: fonts.text, fontSize: 13 },
  sheetStatLabel: { fontFamily: fonts.medium, ...type.caption, marginTop: 2 },
});
