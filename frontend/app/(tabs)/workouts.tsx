import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator,
  RefreshControl, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, spacing, radius, fonts, type as tp } from "@/src/theme";
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

function fmtDuration(s: number) {
  if (!s) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
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
        <View style={styles.empty}>
          <Ionicons name="barbell-outline" size={64} color={colors.brandTertiary} />
          <Text style={styles.emptyTitle}>NENHUM PROGRAMA ATIVO</Text>
          <Text style={styles.emptyText}>
            Escolha um programa de preparação física auxiliar para começar.
          </Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.push("/program-select")}>
            <Text style={styles.emptyBtnText}>ESCOLHER PROGRAMA</Text>
          </Pressable>
        </View>
      );
    }

    const progress = plan.completed_sessions / plan.total_sessions;
    const remaining = plan.total_sessions - plan.completed_sessions;

    return (
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: tabBarPad }}>
        {/* Plan card */}
        <View style={styles.planCard}>
          <View style={styles.planHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.planName}>{plan.program_name}</Text>
              <Text style={styles.planMeta}>
                {LEVEL_LABEL[plan.level]} · {ENV_LABEL[plan.environment]}
              </Text>
            </View>
            <ProgressRing size={72} strokeWidth={6} progress={progress}>
              <Text style={styles.ringNum}>{Math.round(progress * 100)}</Text>
              <Text style={styles.ringPct}>%</Text>
            </ProgressRing>
          </View>

          <View style={styles.planStats}>
            <View style={styles.planStat}>
              <Text style={styles.planStatValue}>{plan.completed_sessions}</Text>
              <Text style={styles.planStatLabel}>CONCLUÍDAS</Text>
            </View>
            <View style={styles.planStat}>
              <Text style={styles.planStatValue}>{remaining}</Text>
              <Text style={styles.planStatLabel}>RESTANTES</Text>
            </View>
            <View style={styles.planStat}>
              <Text style={styles.planStatValue}>{plan.current_session}</Text>
              <Text style={styles.planStatLabel}>PRÓXIMA</Text>
            </View>
          </View>

          {plan.status !== "completed" && (
            <Pressable style={styles.startSessionBtn} onPress={startSession}>
              <Ionicons name="play" size={20} color={colors.onBrandPrimary} />
              <Text style={styles.startSessionText}>
                INICIAR SESSÃO {plan.current_session}
              </Text>
            </Pressable>
          )}

          {plan.status === "completed" && (
            <View style={styles.completedBanner}>
              <Ionicons name="trophy" size={20} color={colors.success} />
              <Text style={styles.completedText}>PROGRAMA CONCLUÍDO</Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <Pressable style={styles.actionBtn} onPress={restartPlan}>
            <Ionicons name="refresh" size={16} color={colors.onSurfaceSecondary} />
            <Text style={styles.actionText}>Recomeçar</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={cancelPlan}>
            <Ionicons name="close-circle-outline" size={16} color={colors.error} />
            <Text style={[styles.actionText, { color: colors.error }]}>Cancelar</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => router.push("/program-select")}>
            <Ionicons name="swap-horizontal" size={16} color={colors.onSurfaceSecondary} />
            <Text style={styles.actionText}>Trocar</Text>
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
        <View style={styles.card}>
          <View style={styles.cardIcon}>
            <Ionicons name="barbell" size={22} color={colors.brandPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title || `Sessão ${item.session_number}`}
            </Text>
            <Text style={styles.cardDate}>
              {fmtDate(item.completed_at || item.started_at || "")} · Semana {item.week} · Dia {item.day}
            </Text>
            <View style={styles.metricsRow}>
              <Metric value={setsCount} label="SÉRIES" />
              <Metric value={item.status === "completed" ? "Concluída" : "Pulada"} label="STATUS" />
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.card}>
        <View style={styles.cardIcon}>
          <Ionicons
            name={TYPE_ICON[item.type || ""] || "fitness"}
            size={22}
            color={colors.brandSecondary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.name || item.type || "Treino"}
          </Text>
          <Text style={styles.cardDate}>
            {fmtDate(item.start_date_local || "")} · {item.type} · intervals.icu
          </Text>
          <View style={styles.metricsRow}>
            <Metric
              value={item.distance ? `${(item.distance / 1000).toFixed(1)}km` : "—"}
              label="DIST"
            />
            <Metric value={fmtDuration(item.moving_time || 0)} label="TEMPO" />
            <Metric
              value={item.icu_training_load ? Math.round(item.icu_training_load) : "—"}
              label="CARGA"
            />
            <Metric
              value={item.average_heartrate ? Math.round(item.average_heartrate) : "—"}
              label="FC"
            />
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View>
          <Text style={styles.kicker}>PREPARAÇÃO FÍSICA</Text>
          <Text style={styles.title}>TREINOS</Text>
        </View>
        {tab === "history" && connected && (
          <Pressable onPress={sync} style={styles.syncBtn} disabled={syncing}>
            {syncing ? (
              <ActivityIndicator color={colors.onBrandPrimary} size="small" />
            ) : (
              <>
                <Ionicons name="sync" size={16} color={colors.onBrandPrimary} />
                <Text style={styles.syncText}>Sync</Text>
              </>
            )}
          </Pressable>
        )}
      </View>

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tabBtn, tab === "plan" && styles.tabBtnActive]}
          onPress={() => setTab("plan")}
        >
          <Text style={[styles.tabText, tab === "plan" && styles.tabTextActive]}>MEU PLANO</Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, tab === "history" && styles.tabBtnActive]}
          onPress={() => setTab("history")}
        >
          <Text style={[styles.tabText, tab === "history" && styles.tabTextActive]}>HISTÓRICO</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : tab === "plan" ? (
        renderPlanContent()
      ) : allHistory.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="time-outline" size={64} color={colors.brandTertiary} />
          <Text style={styles.emptyTitle}>SEM HISTÓRICO</Text>
          <Text style={styles.emptyText}>
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

function Metric({ value, label }: { value: any; label: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end",
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider,
  },
  kicker: { fontFamily: fonts.medium, fontSize: tp.sm, color: colors.brandSecondary, letterSpacing: 2 },
  title: { fontFamily: fonts.display, fontSize: tp["3xl"], color: colors.onSurface, letterSpacing: 1 },
  syncBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.md,
    height: 36, borderRadius: radius.md, minWidth: 80, justifyContent: "center",
  },
  syncText: { fontFamily: fonts.bold, fontSize: tp.sm, color: colors.onBrandPrimary },

  tabRow: {
    flexDirection: "row", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm,
  },
  tabBtn: {
    flex: 1, height: 40, borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  tabBtnActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  tabText: { fontFamily: fonts.bold, fontSize: tp.sm, color: colors.onSurfaceSecondary, letterSpacing: 1 },
  tabTextActive: { color: colors.onBrandPrimary },

  // Plan
  planCard: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border,
  },
  planHeader: { flexDirection: "row", alignItems: "center", marginBottom: spacing.lg },
  planName: { fontFamily: fonts.display, fontSize: tp["2xl"], color: colors.onSurface, letterSpacing: 1 },
  planMeta: { fontFamily: fonts.mono, fontSize: tp.sm, color: colors.onSurfaceSecondary, marginTop: 2 },
  ringNum: { fontFamily: fonts.display, fontSize: tp.xl, color: colors.onSurface },
  ringPct: { fontFamily: fonts.medium, fontSize: tp.sm, color: colors.onSurfaceSecondary },

  planStats: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  planStat: {
    flex: 1, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md,
    paddingVertical: spacing.md, alignItems: "center",
  },
  planStatValue: { fontFamily: fonts.display, fontSize: tp["2xl"], color: colors.onSurface },
  planStatLabel: { fontFamily: fonts.medium, fontSize: 9, color: colors.onSurfaceSecondary, letterSpacing: 1, marginTop: 2 },

  startSessionBtn: {
    flexDirection: "row", gap: spacing.sm, height: 56, borderRadius: radius.md,
    backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center",
  },
  startSessionText: { fontFamily: fonts.bold, fontSize: tp.lg, color: colors.onBrandPrimary, letterSpacing: 1 },

  completedBanner: {
    flexDirection: "row", gap: spacing.sm, height: 56, borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.success,
  },
  completedText: { fontFamily: fonts.bold, fontSize: tp.lg, color: colors.success, letterSpacing: 1 },

  actionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs,
    height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary,
    borderWidth: 1, borderColor: colors.border,
  },
  actionText: { fontFamily: fonts.medium, fontSize: tp.sm, color: colors.onSurfaceSecondary },

  // History cards
  card: {
    flexDirection: "row", gap: spacing.md, backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border,
  },
  cardIcon: {
    width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  cardTitle: { fontFamily: fonts.semibold, fontSize: tp.lg, color: colors.onSurface },
  cardDate: { fontFamily: fonts.mono, fontSize: tp.sm, color: colors.onSurfaceSecondary, marginTop: 2 },
  metricsRow: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.md },
  metric: {},
  metricValue: { fontFamily: fonts.display, fontSize: tp.xl, color: colors.onSurface, fontVariant: ["tabular-nums"] },
  metricLabel: { fontFamily: fonts.medium, fontSize: 9, color: colors.onSurfaceSecondary, letterSpacing: 1 },

  // Empty
  empty: {
    flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontFamily: fonts.display, fontSize: tp["2xl"], color: colors.onSurface,
    letterSpacing: 1, textAlign: "center", marginTop: spacing.lg,
  },
  emptyText: {
    fontFamily: fonts.text, fontSize: tp.base, color: colors.onSurfaceSecondary,
    textAlign: "center", marginTop: spacing.sm, lineHeight: 22,
  },
  emptyBtn: {
    backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.xl,
    height: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center",
    marginTop: spacing.xl,
  },
  emptyBtnText: { fontFamily: fonts.bold, fontSize: tp.base, color: colors.onBrandPrimary, letterSpacing: 1 },
});
