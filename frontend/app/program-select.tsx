import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { spacing, fonts, type } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/lib/api";
import { Screen, ScreenHeader, Card, Chip, PrimaryButton, EmptyState } from "@/src/components/ui";

type Tone = "accent" | "neutral" | "success" | "warning" | "error" | "info";

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Iniciante",
  intermediate: "Intermediário",
  advanced: "Avançado",
};
const LEVEL_TONE: Record<string, Tone> = {
  beginner: "success",
  intermediate: "warning",
  advanced: "error",
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

const DAYS_OPTIONS = [
  { key: 1, label: "1x", hint: "~20-40 min/sem" },
  { key: 2, label: "2x", hint: "recomendado" },
  { key: 3, label: "3x", hint: "mais volume" },
];
const LENGTH_OPTIONS = [
  { key: "full", label: "Completa", hint: "~40 min" },
  { key: "essential", label: "Essencial", hint: "~20 min" },
];

export default function ProgramSelect() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [daysPerWeek, setDaysPerWeek] = useState(2);
  const [sessionLength, setSessionLength] = useState("full");
  const [activePlan, setActivePlan] = useState<any>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, active] = await Promise.all([
        api.get("/programs"),
        api.get("/training/active").catch(() => null),
      ]);
      setPrograms(d.programs || []);
      const plan = active?.plan || null;
      setActivePlan(plan);
      // Inicia os seletores com as preferências do plano ativo, se houver.
      if (plan) {
        if (plan.days_per_week) setDaysPerWeek(plan.days_per_week);
        if (plan.session_length) setSessionLength(plan.session_length);
      }
    } catch {}
    setLoading(false);
  }, []);

  React.useEffect(() => { load(); }, [load]);

  // Aplica as preferências ao plano ATIVO, sem reiniciar (mantém progresso).
  const savePrefs = async () => {
    setSavingPrefs(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.put("/training/preferences", {
        days_per_week: daysPerWeek,
        session_length: sessionLength,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSavingPrefs(false);
    }
  };

  const startProgram = async (p: Program) => {
    setStarting(p.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      // Se já há um plano ativo, troca (cancela e inicia o novo com as prefs).
      if (activePlan) {
        await api.post("/training/cancel").catch(() => {});
      }
      await api.post("/training/start", {
        program_id: p.id,
        session_number: 1,
        days_per_week: daysPerWeek,
        session_length: sessionLength,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setStarting(null);
    }
  };

  // Total de sessões conforme a frequência (1x=8, 2x=16, 3x=24) e semanas estimadas.
  const totalSessions = daysPerWeek === 1 ? 8 : daysPerWeek === 3 ? 24 : 16;
  const estWeeks = Math.ceil(totalSessions / daysPerWeek);

  const header = (
    <View style={s.prefsCard}>
      <View style={[s.prefsInner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[s.prefsTitle, { color: colors.text }]}>Quanto tempo você tem?</Text>
        <Text style={[s.prefsSub, { color: colors.textSecondary }]}>
          Ajustamos frequência e duração à sua rotina. Dá pra mudar depois.
        </Text>

        <Text style={[s.prefsLabel, { color: colors.textSecondary }]}>DIAS POR SEMANA</Text>
        <View style={s.segRow}>
          {DAYS_OPTIONS.map((o) => {
            const on = daysPerWeek === o.key;
            return (
              <Pressable
                key={o.key}
                onPress={() => { Haptics.selectionAsync(); setDaysPerWeek(o.key); }}
                style={[s.seg, { backgroundColor: on ? colors.accent : colors.elevated, borderColor: on ? colors.accent : colors.border }]}
              >
                <Text style={[s.segLabel, { color: on ? colors.onAccent : colors.text }]}>{o.label}</Text>
                <Text style={[s.segHint, { color: on ? colors.onAccent : colors.textSecondary }]}>{o.hint}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[s.prefsLabel, { color: colors.textSecondary }]}>DURAÇÃO DA SESSÃO</Text>
        <View style={s.segRow}>
          {LENGTH_OPTIONS.map((o) => {
            const on = sessionLength === o.key;
            return (
              <Pressable
                key={o.key}
                onPress={() => { Haptics.selectionAsync(); setSessionLength(o.key); }}
                style={[s.seg, { backgroundColor: on ? colors.accent : colors.elevated, borderColor: on ? colors.accent : colors.border }]}
              >
                <Text style={[s.segLabel, { color: on ? colors.onAccent : colors.text }]}>{o.label}</Text>
                <Text style={[s.segHint, { color: on ? colors.onAccent : colors.textSecondary }]}>{o.hint}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[s.estRow, { borderTopColor: colors.border }]}>
          <Ionicons name="sparkles-outline" size={15} color={colors.accent} />
          <Text style={[s.estText, { color: colors.textSecondary }]}>
            {totalSessions} sessões · ~{estWeeks} semanas no seu ritmo
          </Text>
        </View>

        {activePlan && (
          <>
            <Text style={[s.activeNote, { color: colors.textSecondary }]}>
              Você tem um programa ativo ({activePlan.program_name}). Salve para
              aplicar sem perder o progresso, ou troque de programa abaixo.
            </Text>
            <PrimaryButton
              label="Salvar preferências no plano atual"
              icon="checkmark"
              onPress={savePrefs}
              loading={savingPrefs}
              disabled={!!starting}
              style={{ marginTop: spacing.md }}
            />
          </>
        )}
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: Program }) => {
    const active = starting === item.id;
    return (
      <Card>
        <View style={s.cardHeader}>
          <Chip label={LEVEL_LABEL[item.level] || item.level} tone={LEVEL_TONE[item.level] || "accent"} />
          <Chip
            label={ENV_LABEL[item.environment]}
            tone="neutral"
            icon={item.environment === "home" ? "home" : "barbell"}
          />
        </View>

        <Text style={[s.cardTitle, { color: colors.text }]}>{item.name}</Text>
        <Text style={[s.cardDesc, { color: colors.textSecondary }]} numberOfLines={3}>{item.description}</Text>

        <View style={s.cardMeta}>
          <View style={s.metaItem}>
            <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
            <Text style={[s.metaText, { color: colors.textSecondary }]}>~{estWeeks} semanas</Text>
          </View>
          <View style={s.metaItem}>
            <Ionicons name="repeat" size={14} color={colors.textSecondary} />
            <Text style={[s.metaText, { color: colors.textSecondary }]}>{daysPerWeek}x/semana</Text>
          </View>
          <View style={s.metaItem}>
            <Ionicons name="flash" size={14} color={colors.textSecondary} />
            <Text style={[s.metaText, { color: colors.textSecondary }]}>{totalSessions} sessões</Text>
          </View>
        </View>

        <PrimaryButton
          label={activePlan ? "Trocar para este programa" : "Iniciar programa"}
          onPress={() => startProgram(item)}
          loading={active}
          disabled={!!starting || savingPrefs}
          style={s.startBtn}
        />
      </Card>
    );
  };

  return (
    <Screen>
      <ScreenHeader title="Programas" onBack={() => router.back()} />

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={programs}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          ListHeaderComponent={programs.length ? header : null}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.xl,
          }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          ListEmptyComponent={
            <EmptyState
              icon="albums-outline"
              title="Nenhum programa disponível"
              text="Novos programas de preparação física aparecerão aqui."
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  prefsCard: { marginBottom: spacing.md },
  prefsInner: { borderRadius: 20, borderWidth: 1, padding: spacing.lg },
  prefsTitle: { fontFamily: fonts.bold, ...type.h2 },
  prefsSub: { fontFamily: fonts.text, ...type.bodySmall, marginTop: spacing.xs, lineHeight: 18 },
  prefsLabel: {
    fontFamily: fonts.semibold, ...type.caption, letterSpacing: 1,
    textTransform: "uppercase", marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  segRow: { flexDirection: "row", gap: spacing.sm },
  seg: {
    flex: 1, borderRadius: 14, borderWidth: 1,
    paddingVertical: spacing.md, alignItems: "center",
  },
  segLabel: { fontFamily: fonts.bold, ...type.body },
  segHint: { fontFamily: fonts.text, fontSize: 10, lineHeight: 13, marginTop: 2 },
  estRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    borderTopWidth: 1, marginTop: spacing.lg, paddingTop: spacing.md,
  },
  estText: { fontFamily: fonts.medium, ...type.bodySmall },
  activeNote: { fontFamily: fonts.text, ...type.bodySmall, marginTop: spacing.lg, lineHeight: 18 },

  cardHeader: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },

  cardTitle: { fontFamily: fonts.bold, ...type.h2 },
  cardDesc: {
    fontFamily: fonts.text, ...type.bodySmall,
    marginTop: spacing.xs,
  },

  cardMeta: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.md },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontFamily: fonts.text, ...type.caption },

  startBtn: { marginTop: spacing.xl },
});
