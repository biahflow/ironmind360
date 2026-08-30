import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, Alert, Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { spacing, radius, fonts, type } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/lib/api";
import ProgressRing from "@/src/components/ProgressRing";
import {
  Screen, ScreenHeader, Card, PrimaryButton, SecondaryButton,
  PillTabs, EmptyState, layout,
} from "@/src/components/ui";

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
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("plan");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [intervalsItems, setIntervalsItems] = useState<HistoryItem[]>([]);
  const [connected, setConnected] = useState(true);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const tabBarPad = layout.tabBarPad(insets.bottom);

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
      // Puxa também métricas de saúde (sono, FC repouso, HRV, peso) do intervals.
      // Best-effort: se a conta não tiver dados de wellness, não deve derrubar o
      // sync de treinos que acabou de dar certo.
      try { await api.post("/intervals/sync-wellness?days=30"); } catch {}
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
        <EmptyState
          icon="barbell-outline"
          title="Como quer treinar hoje?"
          text="Siga um programa de preparação física estruturado ou monte seu próprio treino escolhendo os exercícios."
          action={
            <View style={{ alignSelf: "stretch", gap: spacing.md }}>
              <PrimaryButton
                label="Seguir um programa"
                icon="list-outline"
                onPress={() => router.push("/program-select")}
              />
              <SecondaryButton
                label="Montar meu treino"
                icon="add-circle-outline"
                color={colors.accent}
                onPress={() => router.push("/custom-workout")}
              />
            </View>
          }
        />
      );
    }

    const progress = plan.completed_sessions / plan.total_sessions;
    const remaining = plan.total_sessions - plan.completed_sessions;

    return (
      <View style={{ paddingHorizontal: layout.screenPad, paddingTop: spacing.md, paddingBottom: tabBarPad }}>
        {/* Plan card */}
        <Card large>
          <View style={s.planHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[s.planName, { color: colors.text }]}>{plan.program_name}</Text>
              <Text style={[s.planMeta, { color: colors.textSecondary }]}>
                {LEVEL_LABEL[plan.level]} · {ENV_LABEL[plan.environment]}
              </Text>
            </View>
            <ProgressRing size={72} strokeWidth={6} progress={progress}>
              <Text style={[s.ringNum, { color: colors.text }]}>{Math.round(progress * 100)}</Text>
              <Text style={[s.ringPct, { color: colors.textSecondary }]}>%</Text>
            </ProgressRing>
          </View>

          <View style={[s.planStats, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
            <View style={s.planStat}>
              <Text style={[s.planStatValue, { color: colors.text }]}>{plan.completed_sessions}</Text>
              <Text style={[s.planStatLabel, { color: colors.textSecondary }]}>Concluídas</Text>
            </View>
            <View style={[s.planStatDivider, { backgroundColor: colors.border }]} />
            <View style={s.planStat}>
              <Text style={[s.planStatValue, { color: colors.text }]}>{remaining}</Text>
              <Text style={[s.planStatLabel, { color: colors.textSecondary }]}>Restantes</Text>
            </View>
            <View style={[s.planStatDivider, { backgroundColor: colors.border }]} />
            <View style={s.planStat}>
              <Text style={[s.planStatValue, { color: colors.text }]}>{plan.current_session}</Text>
              <Text style={[s.planStatLabel, { color: colors.textSecondary }]}>Próxima</Text>
            </View>
          </View>

          {plan.status !== "completed" && (
            <PrimaryButton
              icon="play"
              label={`Iniciar sessão ${plan.current_session}`}
              onPress={startSession}
            />
          )}

          {plan.status === "completed" && (
            <View style={[s.completedBanner, { backgroundColor: colors.successMuted }]}>
              <Ionicons name="trophy" size={20} color={colors.success} />
              <Text style={[s.completedText, { color: colors.success }]}>Programa concluído</Text>
            </View>
          )}
        </Card>

        {/* Actions */}
        <View style={s.actionsRow}>
          <SecondaryButton
            style={{ flex: 1 }}
            icon="refresh"
            label="Recomeçar"
            onPress={restartPlan}
          />
          <SecondaryButton
            style={{ flex: 1 }}
            icon="close-circle-outline"
            label="Cancelar"
            color={colors.error}
            onPress={cancelPlan}
          />
          <SecondaryButton
            style={{ flex: 1 }}
            icon="swap-horizontal"
            label="Trocar"
            onPress={() => router.push("/program-select")}
          />
        </View>

        <SecondaryButton
          style={{ marginTop: spacing.md }}
          icon="add-circle-outline"
          label="Montar treino avulso"
          color={colors.accent}
          onPress={() => router.push("/custom-workout")}
        />
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
        <Card style={s.card}>
          <View style={[s.cardIcon, { backgroundColor: colors.accentMuted }]}>
            <Ionicons name="barbell" size={22} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.cardTitle, { color: colors.text }]} numberOfLines={1}>
              {item.title || `Sessão ${item.session_number}`}
            </Text>
            <Text style={[s.cardDate, { color: colors.textSecondary }]}>
              {fmtDate(item.completed_at || item.started_at || "")} · Semana {item.week} · Dia {item.day}
            </Text>
            <View style={s.metricsRow}>
              <Metric value={setsCount} label="Séries" colors={colors} />
              <Metric value={item.status === "completed" ? "Concluída" : "Pulada"} label="Status" colors={colors} />
            </View>
          </View>
        </Card>
      );
    }

    return (
      <Card style={s.card}>
        <View style={[s.cardIcon, { backgroundColor: colors.accentMuted }]}>
          <Ionicons
            name={TYPE_ICON[item.type || ""] || "fitness"}
            size={22}
            color={colors.accent}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.cardTitle, { color: colors.text }]} numberOfLines={1}>
            {item.name || item.type || "Treino"}
          </Text>
          <Text style={[s.cardDate, { color: colors.textSecondary }]}>
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
      </Card>
    );
  };

  return (
    <Screen>
      <ScreenHeader
        title="Treinos"
        right={
          tab === "history" && connected ? (
            <Pressable
              onPress={sync}
              disabled={syncing}
              style={[s.syncBtn, { backgroundColor: colors.accent }]}
            >
              {syncing ? (
                <ActivityIndicator color={colors.onAccent} size="small" />
              ) : (
                <>
                  <Ionicons name="sync" size={16} color={colors.onAccent} />
                  <Text style={[s.syncText, { color: colors.onAccent }]}>Sync</Text>
                </>
              )}
            </Pressable>
          ) : undefined
        }
      />

      {/* Tab switcher */}
      <PillTabs<Tab>
        tabs={[
          { key: "plan", label: "Meu plano" },
          { key: "history", label: "Histórico" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : tab === "plan" ? (
        renderPlanContent()
      ) : allHistory.length === 0 ? (
        <EmptyState
          icon="time-outline"
          title="Sem histórico"
          text={
            connected
              ? "Sincronize com o intervals.icu ou complete uma sessão do seu programa."
              : "Conecte o intervals.icu nas configurações ou inicie um programa."
          }
        />
      ) : (
        <FlatList
          data={allHistory}
          keyExtractor={(i) => i.id}
          renderItem={renderHistoryItem}
          contentContainerStyle={{
            paddingHorizontal: layout.screenPad, paddingTop: spacing.md, paddingBottom: tabBarPad,
          }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={load} tintColor={colors.accent} />
          }
        />
      )}
    </Screen>
  );
}

function Metric({ value, label, colors }: { value: any; label: string; colors: any }) {
  return (
    <View style={s.metric}>
      <Text style={[s.metricValue, { color: colors.text }]}>{value}</Text>
      <Text style={[s.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  syncBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    height: 40, borderRadius: radius.pill, minWidth: 80, justifyContent: "center",
  },
  syncText: { fontFamily: fonts.bold, ...type.bodySmall },

  // Plan
  planHeader: { flexDirection: "row", alignItems: "center", marginBottom: spacing.xl },
  planName: { fontFamily: fonts.bold, ...type.h2 },
  planMeta: { fontFamily: fonts.text, ...type.bodySmall, marginTop: 2 },
  ringNum: { fontFamily: fonts.bold, ...type.h2 },
  ringPct: { fontFamily: fonts.medium, ...type.bodySmall },

  planStats: {
    flexDirection: "row", alignItems: "center",
    borderTopWidth: 1, borderBottomWidth: 1,
    paddingVertical: spacing.lg, marginBottom: spacing.xl,
  },
  planStat: { flex: 1, alignItems: "center" },
  planStatDivider: { width: 1, height: 32 },
  planStatValue: { fontFamily: fonts.bold, ...type.metric, fontVariant: ["tabular-nums"] },
  planStatLabel: {
    fontFamily: fonts.medium, ...type.caption, letterSpacing: 1, marginTop: 2,
  },

  completedBanner: {
    flexDirection: "row", gap: spacing.sm, height: 56, borderRadius: radius.lg,
    alignItems: "center", justifyContent: "center",
  },
  completedText: { fontFamily: fonts.bold, ...type.body },

  actionsRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing["2xl"] },

  // History cards
  card: {
    flexDirection: "row", gap: spacing.lg,
  },
  cardIcon: {
    width: 48, height: 48, borderRadius: radius.lg,
    alignItems: "center", justifyContent: "center",
  },
  cardTitle: { fontFamily: fonts.semibold, ...type.body },
  cardDate: { fontFamily: fonts.text, ...type.bodySmall, marginTop: 2 },
  metricsRow: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.lg },
  metric: {},
  metricValue: { fontFamily: fonts.bold, ...type.h2, fontVariant: ["tabular-nums"] },
  metricLabel: {
    fontFamily: fonts.medium, ...type.caption, letterSpacing: 1,
  },
});
