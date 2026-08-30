import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator,
  RefreshControl, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { spacing, radius, fonts, type as tp, shadow } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/lib/api";
import ProgressRing from "@/src/components/ProgressRing";

type Tab = "plan" | "history";

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Iniciante", intermediate: "Intermediário", advanced: "Avançado",
};
const ENV_LABEL: Record<string, string> = { home: "Casa", gym: "Academia" };

const TYPE_ICON: Record<string, any> = {
  Ride: "bicycle", VirtualRide: "bicycle", Run: "walk", Swim: "water",
  Workout: "barbell", WeightTraining: "barbell", Walk: "footsteps",
  ironmind: "barbell",
};

function fmtDuration(sec: number) {
  if (!sec) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m}min`;
}

function fmtDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

type Plan = {
  id: string;
  program_id: string;
  program_name: string;
  level: string;
  environment: string;
  total_sessions: number;
  completed_sessions: number;
  current_session: number;
  status: string;
};

type HistoryItem = {
  id: string;
  title?: string;
  name?: string;
  type?: string;
  session_number?: number;
  week?: number;
  day?: string;
  status?: string;
  completed_at?: string;
  started_at?: string;
  start_date_local?: string;
  source?: string;
  distance?: number;
  moving_time?: number;
  icu_training_load?: number;
  average_heartrate?: number;
  exercises?: any[];
};

export default function Workouts() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("plan");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [intervalsItems, setIntervalsItems] = useState<HistoryItem[]>([]);
  const [connected, setConnected] = useState(true);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const tabBarPad = 64 + insets.bottom + spacing.lg;

  const load = useCallback(async () => {
    try {
      const [planRes, historyRes, workoutsRes] = await Promise.all([
        api.get("/training/active"),
        api.get("/training/history"),
        api.get("/workouts"),
      ]);
      setPlan(planRes.plan || null);
      setHistory(historyRes.sessions || []);
      setIntervalsItems(workoutsRes.workouts || []);
      setConnected(workoutsRes.connected);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const sync = async () => {
    if (!connected) { router.push("/settings"); return; }
    setSyncing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.post("/intervals/sync");
      await load();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSyncing(false);
    }
  };

  const startSession = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push("/session");
  };

  const cancelPlan = () => {
    Alert.alert(
      "Cancelar programa",
      "Tem certeza? Seu progresso será perdido.",
      [
        { text: "Não", style: "cancel" },
        {
          text: "Cancelar programa", style: "destructive",
          onPress: async () => {
            try {
              await api.post("/training/cancel");
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await load();
            } catch {}
          },
        },
      ]
    );
  };

  const restartPlan = () => {
    Alert.alert(
      "Recomeçar programa",
      "Isto reiniciará o programa da sessão 1. Continuar?",
      [
        { text: "Não", style: "cancel" },
        {
          text: "Recomeçar", style: "default",
          onPress: async () => {
            try {
              await api.post("/training/restart");
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await load();
            } catch {}
          },
        },
      ]
    );
  };

  const renderPlanContent = () => {
    if (!plan) {
      return (
        <View style={s.empty}>
          <Ionicons name="barbell-outline" size={64} color={colors.brandTertiary} />
          <Text style={[s.emptyTitle, { color: colors.onSurface }]}>Nenhum programa ativo</Text>
          <Text style={[s.emptyText, { color: colors.onSurfaceSecondary }]}>
            Escolha um programa de preparação física auxiliar para começar.
          </Text>
          <Pressable style={[s.emptyBtn, { backgroundColor: colors.brandPrimary, ...shadow.glow(colors.brandPrimary) }]} onPress={() => router.push("/program-select")}>
            <Text style={[s.emptyBtnText, { color: colors.onBrandPrimary }]}>Escolher programa</Text>
          </Pressable>
        </View>
      );
    }

    const progress = plan.completed_sessions / plan.total_sessions;
    const remaining = plan.total_sessions - plan.completed_sessions;

    return (
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: tabBarPad }}>
        {/* Plan card */}
        <View style={[s.planCard, { backgroundColor: colors.cardBackground, ...(isDark ? {} : shadow.md) }]}>
          <View style={s.planHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[s.planName, { color: colors.onSurface }]}>{plan.program_name}</Text>
              <Text style={[s.planMeta, { color: colors.onSurfaceSecondary }]}>
                {LEVEL_LABEL[plan.level]} · {ENV_LABEL[plan.environment]}
              </Text>
            </View>
            <ProgressRing size={72} strokeWidth={6} progress={progress}>
              <Text style={[s.ringNum, { color: colors.onSurface }]}>{Math.round(progress * 100)}</Text>
              <Text style={[s.ringPct, { color: colors.onSurfaceSecondary }]}>%</Text>
            </ProgressRing>
          </View>

          <View style={s.planStats}>
            <View style={[s.planStat, { backgroundColor: colors.surfaceTertiary }]}>
              <Text style={[s.planStatValue, { color: colors.onSurface }]}>{plan.completed_sessions}</Text>
              <Text style={[s.planStatLabel, { color: colors.onSurfaceSecondary }]}>Concluídas</Text>
            </View>
            <View style={[s.planStat, { backgroundColor: colors.surfaceTertiary }]}>
              <Text style={[s.planStatValue, { color: colors.onSurface }]}>{remaining}</Text>
              <Text style={[s.planStatLabel, { color: colors.onSurfaceSecondary }]}>Restantes</Text>
            </View>
            <View style={[s.planStat, { backgroundColor: colors.surfaceTertiary }]}>
              <Text style={[s.planStatValue, { color: colors.onSurface }]}>{plan.current_session}</Text>
              <Text style={[s.planStatLabel, { color: colors.onSurfaceSecondary }]}>Próxima</Text>
            </View>
          </View>

          {plan.status !== "completed" && (
            <Pressable style={[s.startSessionBtn, { backgroundColor: colors.brandPrimary, ...shadow.glow(colors.brandPrimary) }]} onPress={startSession}>
              <Ionicons name="play" size={20} color={colors.onBrandPrimary} />
              <Text style={[s.startSessionText, { color: colors.onBrandPrimary }]}>
                Iniciar sessão {plan.current_session}
              </Text>
            </Pressable>
          )}

          {plan.status === "completed" && (
            <View style={[s.completedBanner, { backgroundColor: colors.surfaceTertiary }]}>
              <Ionicons name="trophy" size={20} color={colors.success} />
              <Text style={[s.completedText, { color: colors.success }]}>Programa concluído</Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={s.actionsRow}>
          <Pressable style={[s.actionBtn, { backgroundColor: colors.cardBackground, ...(isDark ? {} : shadow.sm) }]} onPress={restartPlan}>
            <Ionicons name="refresh" size={16} color={colors.onSurfaceSecondary} />
            <Text style={[s.actionText, { color: colors.onSurfaceSecondary }]}>Recomeçar</Text>
          </Pressable>
          <Pressable style={[s.actionBtn, { backgroundColor: colors.cardBackground, ...(isDark ? {} : shadow.sm) }]} onPress={cancelPlan}>
            <Ionicons name="close-circle-outline" size={16} color={colors.error} />
            <Text style={[s.actionText, { color: colors.error }]}>Cancelar</Text>
          </Pressable>
          <Pressable style={[s.actionBtn, { backgroundColor: colors.cardBackground, ...(isDark ? {} : shadow.sm) }]} onPress={() => router.push("/program-select")}>
            <Ionicons name="swap-horizontal" size={16} color={colors.onSurfaceSecondary} />
            <Text style={[s.actionText, { color: colors.onSurfaceSecondary }]}>Trocar</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const allHistory: HistoryItem[] = [
    ...history.map((h) => ({ ...h, source: "ironmind" })),
    ...intervalsItems.map((w) => ({ ...w, source: "intervals" })),
  ].sort((a, b) => {
    const da = a.completed_at || a.start_date_local || "";
    const db = b.completed_at || b.start_date_local || "";
    return db.localeCompare(da);
  });

  const renderHistoryItem = ({ item }: { item: HistoryItem }) => {
    if (item.source === "ironmind") {
      const setsCount = (item.exercises || []).reduce(
        (acc: number, ex: any) => acc + (ex.sets?.length || 0), 0
      );
      return (
        <View style={[s.card, { backgroundColor: colors.cardBackground, ...(isDark ? {} : shadow.sm) }]}>
          <View style={[s.cardIcon, { backgroundColor: colors.brandTertiary }]}>
            <Ionicons name="barbell" size={22} color={colors.brandPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.cardTitle, { color: colors.onSurface }]} numberOfLines={1}>
              {item.title || `Sessão ${item.session_number}`}
            </Text>
            <Text style={[s.cardDate, { color: colors.onSurfaceSecondary }]}>
              {fmtDate(item.completed_at || item.started_at || "")} · Semana {item.week} · Dia {item.day}
            </Text>
            <View style={s.metricsRow}>
              <Metric value={setsCount} label="Séries" colors={colors} />
              <Metric value={item.status === "completed" ? "Concluída" : "Pulada"} label="Status" colors={colors} />
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={[s.card, { backgroundColor: colors.cardBackground, ...(isDark ? {} : shadow.sm) }]}>
        <View style={[s.cardIcon, { backgroundColor: colors.brandTertiary }]}>
          <Ionicons
            name={TYPE_ICON[item.type || ""] || "fitness"}
            size={22}
            color={colors.brandSecondary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.cardTitle, { color: colors.onSurface }]} numberOfLines={1}>
            {item.name || item.type || "Treino"}
          </Text>
          <Text style={[s.cardDate, { color: colors.onSurfaceSecondary }]}>
            {fmtDate(item.start_date_local || "")} · {item.type} · intervals.icu
          </Text>
          <View style={s.metricsRow}>
            <Metric
              value={item.distance ? `${(item.distance / 1000).toFixed(1)}km` : "—"}
              label="Dist"
              colors={colors}
            />
            <Metric value={fmtDuration(item.moving_time || 0)} label="Tempo" colors={colors} />
            <Metric
              value={item.icu_training_load ? Math.round(item.icu_training_load) : "—"}
              label="Carga"
              colors={colors}
            />
            <Metric
              value={item.average_heartrate ? Math.round(item.average_heartrate) : "—"}
              label="FC"
              colors={colors}
            />
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[s.root, { backgroundColor: colors.surface }]}>
      <View style={[s.header, { paddingTop: insets.top + spacing.md, borderBottomColor: colors.divider }]}>
        <View>
          <Text style={[s.kicker, { color: colors.brandPrimary }]}>Treino</Text>
          <Text style={[s.title, { color: colors.onSurface }]}>Treinos</Text>
        </View>
        {tab === "history" && connected && (
          <Pressable onPress={sync} style={[s.syncBtn, { backgroundColor: colors.brandPrimary }]} disabled={syncing}>
            {syncing ? (
              <ActivityIndicator color={colors.onBrandPrimary} size="small" />
            ) : (
              <>
                <Ionicons name="sync" size={16} color={colors.onBrandPrimary} />
                <Text style={[s.syncText, { color: colors.onBrandPrimary }]}>Sync</Text>
              </>
            )}
          </Pressable>
        )}
      </View>

      {/* Tab switcher */}
      <View style={s.tabRow}>
        <Pressable
          style={[s.tabBtn, { backgroundColor: tab === "plan" ? colors.brandPrimary : colors.surfaceTertiary }]}
          onPress={() => setTab("plan")}
        >
          <Text style={[s.tabText, { color: tab === "plan" ? colors.onBrandPrimary : colors.onSurfaceSecondary }]}>Meu plano</Text>
        </Pressable>
        <Pressable
          style={[s.tabBtn, { backgroundColor: tab === "history" ? colors.brandPrimary : colors.surfaceTertiary }]}
          onPress={() => setTab("history")}
        >
          <Text style={[s.tabText, { color: tab === "history" ? colors.onBrandPrimary : colors.onSurfaceSecondary }]}>Histórico</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : tab === "plan" ? (
        renderPlanContent()
      ) : allHistory.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="time-outline" size={64} color={colors.brandTertiary} />
          <Text style={[s.emptyTitle, { color: colors.onSurface }]}>Sem histórico</Text>
          <Text style={[s.emptyText, { color: colors.onSurfaceSecondary }]}>
            {connected
              ? "Sincronize com o intervals.icu ou complete uma sessão do seu programa."
              : "Conecte o intervals.icu nas configurações ou inicie um programa."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={allHistory}
          keyExtractor={(i) => i.id}
          renderItem={renderHistoryItem}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: tabBarPad,
          }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={load} tintColor={colors.brandPrimary} />
          }
        />
      )}
    </View>
  );
}

function Metric({ value, label, colors }: { value: any; label: string; colors: any }) {
  return (
    <View style={s.metric}>
      <Text style={[s.metricValue, { color: colors.onSurface }]}>{value}</Text>
      <Text style={[s.metricLabel, { color: colors.onSurfaceSecondary }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end",
    paddingHorizontal: spacing.xl, paddingBottom: spacing.lg,
  },
  kicker: { fontFamily: fonts.medium, fontSize: tp.sm, letterSpacing: 2 },
  title: { fontFamily: fonts.display, fontSize: tp["3xl"], letterSpacing: 1 },
  syncBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    height: 40, borderRadius: radius.pill, minWidth: 80, justifyContent: "center",
  },
  syncText: { fontFamily: fonts.bold, fontSize: tp.sm },

  tabRow: {
    flexDirection: "row", paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.sm,
  },
  tabBtn: {
    flex: 1, height: 44, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
  },
  tabText: { fontFamily: fonts.bold, fontSize: tp.sm, letterSpacing: 1 },

  // Plan
  planCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  planHeader: { flexDirection: "row", alignItems: "center", marginBottom: spacing.xl },
  planName: { fontFamily: fonts.display, fontSize: tp["2xl"], letterSpacing: 1 },
  planMeta: { fontFamily: fonts.mono, fontSize: tp.sm, marginTop: 2 },
  ringNum: { fontFamily: fonts.display, fontSize: tp.xl },
  ringPct: { fontFamily: fonts.medium, fontSize: tp.sm },

  planStats: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.xl },
  planStat: {
    flex: 1, borderRadius: radius.lg,
    paddingVertical: spacing.lg, alignItems: "center",
  },
  planStatValue: { fontFamily: fonts.display, fontSize: tp["2xl"] },
  planStatLabel: { fontFamily: fonts.medium, fontSize: 9, letterSpacing: 1, marginTop: 2 },

  startSessionBtn: {
    flexDirection: "row", gap: spacing.sm, height: 56, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
  },
  startSessionText: { fontFamily: fonts.bold, fontSize: tp.lg, letterSpacing: 1 },

  completedBanner: {
    flexDirection: "row", gap: spacing.sm, height: 56, borderRadius: radius.lg,
    alignItems: "center", justifyContent: "center",
  },
  completedText: { fontFamily: fonts.bold, fontSize: tp.lg, letterSpacing: 1 },

  actionsRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing["2xl"] },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs,
    height: 44, borderRadius: radius.pill,
  },
  actionText: { fontFamily: fonts.medium, fontSize: tp.sm },

  // History cards
  card: {
    flexDirection: "row", gap: spacing.lg,
    borderRadius: radius.lg, padding: spacing.xl,
  },
  cardIcon: {
    width: 48, height: 48, borderRadius: radius.lg,
    alignItems: "center", justifyContent: "center",
  },
  cardTitle: { fontFamily: fonts.semibold, fontSize: tp.lg },
  cardDate: { fontFamily: fonts.mono, fontSize: tp.sm, marginTop: 2 },
  metricsRow: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.lg },
  metric: {},
  metricValue: { fontFamily: fonts.display, fontSize: tp.xl, fontVariant: ["tabular-nums"] },
  metricLabel: { fontFamily: fonts.medium, fontSize: 9, letterSpacing: 1 },

  // Empty
  empty: {
    flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing["2xl"],
  },
  emptyTitle: {
    fontFamily: fonts.display, fontSize: tp["2xl"],
    letterSpacing: 1, textAlign: "center", marginTop: spacing.xl,
  },
  emptyText: {
    fontFamily: fonts.text, fontSize: tp.base,
    textAlign: "center", marginTop: spacing.md, lineHeight: 22,
  },
  emptyBtn: {
    paddingHorizontal: spacing["2xl"],
    height: 56, borderRadius: radius.pill, alignItems: "center", justifyContent: "center",
    marginTop: spacing["2xl"],
  },
  emptyBtnText: { fontFamily: fonts.bold, fontSize: tp.base, letterSpacing: 1 },
});
