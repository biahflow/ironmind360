import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Modal, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { spacing, radius, fonts, type } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/lib/api";
import {
  Screen, ScreenHeader, Card, PillTabs, Overline, EmptyState, LoadingState,
  Input, PrimaryButton, SecondaryButton, layout,
} from "@/src/components/ui";

type Tab = "overview" | "records" | "races";

export default function Analytics() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <Screen>
      <ScreenHeader title="Analytics" />
      <PillTabs
        tabs={[
          { key: "overview" as Tab, label: "Visão geral" },
          { key: "records" as Tab, label: "Recordes" },
          { key: "races" as Tab, label: "Provas" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "overview" && <OverviewTab />}
      {tab === "records" && <RecordsTab />}
      {tab === "races" && <RacesTab />}
    </Screen>
  );
}

function OverviewTab() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [consistency, setConsistency] = useState<any>(null);
  const [correlations, setCorrelations] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, cor] = await Promise.all([
        api.get("/analytics/consistency?days=28"),
        api.get("/analytics/correlations?days=28"),
      ]);
      setConsistency(c);
      setCorrelations(cor);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <LoadingState />;

  return (
    <ScrollView contentContainerStyle={[s.content, { paddingBottom: layout.tabBarPad(insets.bottom) }]}>
      {consistency && (
        <Card>
          <Overline color={colors.accent}>Consistência · 28 dias</Overline>
          <View style={s.statsRow}>
            <StatItem label="Treinos" value={`${consistency.activity_days}/${consistency.total_days}`} sub={`${consistency.activity_rate}%`} colors={colors} />
            <StatItem label="Check-ins" value={`${consistency.checkin_days}/${consistency.total_days}`} sub={`${consistency.checkin_rate}%`} colors={colors} />
            <StatItem label="Refeições" value={`${consistency.meal_days}/${consistency.total_days}`} sub={`${consistency.meal_rate}%`} colors={colors} />
          </View>
        </Card>
      )}

      {correlations?.observations?.length > 0 && (
        <Card>
          <Overline color={colors.accent}>Observações</Overline>
          {correlations.observations.map((o: any, i: number) => (
            <View key={i} style={s.obsItem}>
              <Ionicons name="analytics-outline" size={16} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[s.obsText, { color: colors.text }]}>{o.observation}</Text>
                <Text style={[s.obsDisclaimer, { color: colors.textSecondary }]}>{o.disclaimer}</Text>
              </View>
            </View>
          ))}
        </Card>
      )}

      {(!correlations?.observations?.length) && (
        <Card>
          <Overline color={colors.accent}>Observações</Overline>
          <Text style={[s.obsText, { color: colors.textSecondary }]}>
            Continue registrando treinos e check-ins — com mais dados, padrões aparecerão aqui.
          </Text>
          <Text style={[s.obsDisclaimer, { color: colors.textSecondary }]}>
            Correlações são observacionais, não indicam causa e efeito.
          </Text>
        </Card>
      )}
    </ScrollView>
  );
}

function StatItem({ label, value, sub, colors }: any) {
  return (
    <View style={s.statItem}>
      <Text style={[s.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[s.statSub, { color: colors.accent }]}>{sub}</Text>
      <Text style={[s.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function RecordsTab() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get("/analytics/personal-records");
      setRecords(d.records);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <LoadingState />;

  const formatPace = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.round(seconds % 60);
    return `${min}:${sec.toString().padStart(2, "0")}/km`;
  };

  const sections = [
    { key: "running", title: "Corrida", icon: "walk-outline" as const },
    { key: "cycling", title: "Ciclismo", icon: "bicycle-outline" as const },
    { key: "swimming", title: "Natação", icon: "water-outline" as const },
    { key: "strength", title: "Força", icon: "barbell-outline" as const },
  ];

  return (
    <ScrollView contentContainerStyle={[s.content, { paddingBottom: layout.tabBarPad(insets.bottom) }]}>
      {sections.map((sec) => {
        const data = records?.[sec.key] || {};
        const entries = Object.entries(data);
        if (entries.length === 0) return null;
        return (
          <Card key={sec.key}>
            <View style={s.sectionHead}>
              <Ionicons name={sec.icon} size={18} color={colors.accent} />
              <Overline color={colors.accent}>{sec.title}</Overline>
            </View>
            {entries.map(([key, val]: [string, any]) => (
              <View key={key} style={s.recordRow}>
                <Text style={[s.recordLabel, { color: colors.textSecondary }]}>
                  {key.replace(/^(best_pace_|best_|longest_|pr_)/, "")}
                </Text>
                <Text style={[s.recordValue, { color: colors.text }]}>
                  {val.unit === "s/km" ? formatPace(val.value) :
                   val.unit === "s/100m" ? `${Math.floor(val.value / 60)}:${Math.round(val.value % 60).toString().padStart(2, "0")}/100m` :
                   `${val.value} ${val.unit}`}
                </Text>
                <Text style={[s.recordDate, { color: colors.textSecondary }]}>{val.date}</Text>
              </View>
            ))}
          </Card>
        );
      })}
      {sections.every((sec) => Object.keys(records?.[sec.key] || {}).length === 0) && (
        <EmptyState icon="trophy-outline" title="Nenhum recorde ainda" text="Complete atividades para registrar seus melhores resultados." />
      )}
    </ScrollView>
  );
}

const RACE_TYPES = [
  { key: "sprint", label: "Sprint" },
  { key: "olympic", label: "Olímpico" },
  { key: "half_ironman", label: "70.3" },
  { key: "ironman", label: "Ironman" },
  { key: "custom", label: "Outra" },
];
const PRIORITIES = [
  { key: "A", label: "A · Principal" },
  { key: "B", label: "B · Secundária" },
  { key: "C", label: "C · Treino" },
];

function RacesTab() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [races, setRaces] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get("/analytics/race-history");
      setRaces(d.races || []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <LoadingState />;

  const raceTypeLabel: Record<string, string> = {
    sprint: "Sprint", olympic: "Olímpico",
    half_ironman: "70.3", ironman: "Ironman", custom: "Custom",
  };

  const stars = (rating: number) => "★".repeat(rating) + "☆".repeat(5 - rating);

  return (
    <ScrollView contentContainerStyle={[s.content, { paddingBottom: layout.tabBarPad(insets.bottom) }]}>
      <PrimaryButton label="Adicionar prova" icon="add" onPress={() => setAdding(true)} />

      <RaceModal
        visible={adding}
        onClose={() => setAdding(false)}
        onSaved={() => { setAdding(false); load(); }}
      />

      {races.length === 0 ? (
        <EmptyState
          icon="flag-outline"
          title="Nenhuma prova registrada"
          text="Cadastre suas provas para acompanhar objetivos, estratégia e retrospectiva."
        />
      ) : (
        races.map((r) => (
          <Card key={r.id}>
            <View style={s.raceHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[s.raceName, { color: colors.text }]}>{r.name}</Text>
                <Text style={[s.raceType, { color: colors.textSecondary }]}>
                  {raceTypeLabel[r.race_type] || r.race_type} · {r.date} · Prioridade {r.priority}
                </Text>
              </View>
            </View>
            {r.retrospective && (
              <View style={s.retroSection}>
                <Text style={[s.retroStars, { color: colors.accent }]}>
                  {stars(r.retrospective.overall_rating)}
                </Text>
                {r.retrospective.finish_time && (
                  <Text style={[s.retroTime, { color: colors.text }]}>
                    Tempo: {r.retrospective.finish_time}
                  </Text>
                )}
                {r.retrospective.placement && (
                  <Text style={[s.retroPlacement, { color: colors.textSecondary }]}>
                    Colocação: {r.retrospective.placement}
                  </Text>
                )}
              </View>
            )}
            {r.result && !r.retrospective && (
              <Text style={[s.raceResult, { color: colors.textSecondary }]}>{r.result}</Text>
            )}
          </Card>
        ))
      )}
    </ScrollView>
  );
}

function RaceModal({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [raceType, setRaceType] = useState("olympic");
  const [priority, setPriority] = useState("B");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [goal, setGoal] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setName(""); setRaceType("olympic"); setPriority("B");
    setDate(""); setLocation(""); setGoal(""); setError("");
  };

  const save = async () => {
    if (!name.trim()) { setError("Informe o nome da prova."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) { setError("Data no formato AAAA-MM-DD."); return; }
    setSaving(true);
    setError("");
    try {
      await api.post("/races", {
        name: name.trim(),
        race_type: raceType,
        priority,
        date: date.trim(),
        location: location.trim(),
        goal: goal.trim(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      reset();
      onSaved();
    } catch (e: any) {
      setError(e.message || "Falha ao cadastrar prova.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen>
        <View style={[s.modalHeader, { paddingTop: insets.top + spacing.md }]}>
          <Text style={[s.modalTitle, { color: colors.text }]}>Nova prova</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing["3xl"], gap: spacing.lg }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Input label="Nome" placeholder="Ex: Ironman 70.3 Florianópolis" value={name} onChangeText={setName} />

          <View>
            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>MODALIDADE</Text>
            <View style={s.pickRow}>
              {RACE_TYPES.map((t) => {
                const active = raceType === t.key;
                return (
                  <Pressable
                    key={t.key}
                    onPress={() => setRaceType(t.key)}
                    style={[s.pick, { backgroundColor: active ? colors.accent : colors.surface, borderColor: active ? colors.accent : colors.border }]}
                  >
                    <Text style={[s.pickText, { color: active ? colors.onAccent : colors.textSecondary }]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View>
            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>PRIORIDADE</Text>
            <View style={s.pickRow}>
              {PRIORITIES.map((p) => {
                const active = priority === p.key;
                return (
                  <Pressable
                    key={p.key}
                    onPress={() => setPriority(p.key)}
                    style={[s.pick, { backgroundColor: active ? colors.accent : colors.surface, borderColor: active ? colors.accent : colors.border }]}
                  >
                    <Text style={[s.pickText, { color: active ? colors.onAccent : colors.textSecondary }]}>{p.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Input label="Data" placeholder="AAAA-MM-DD" value={date} onChangeText={setDate} autoCapitalize="none" />
          <Input label="Local (opcional)" placeholder="Cidade / país" value={location} onChangeText={setLocation} />
          <Input label="Objetivo (opcional)" placeholder="Ex: sub 5h30" value={goal} onChangeText={setGoal} />

          {error ? <Text style={[s.raceError, { color: colors.error }]}>{error}</Text> : null}

          <PrimaryButton label="Salvar prova" onPress={save} loading={saving} style={{ marginTop: spacing.sm }} />
          <SecondaryButton label="Cancelar" onPress={onClose} />
        </ScrollView>
      </Screen>
    </Modal>
  );
}

const s = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.md },

  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingBottom: spacing.lg,
  },
  modalTitle: { fontFamily: fonts.bold, ...type.h1 },
  fieldLabel: {
    fontFamily: fonts.semibold, ...type.caption, letterSpacing: 1,
    textTransform: "uppercase", marginBottom: spacing.sm,
  },
  pickRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  pick: {
    paddingHorizontal: spacing.lg, height: 40, borderRadius: radius.pill, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  pickText: { fontFamily: fonts.semibold, ...type.bodySmall },
  raceError: { fontFamily: fonts.text, ...type.bodySmall },

  statsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md },
  statItem: { alignItems: "center", flex: 1 },
  statValue: { fontFamily: fonts.bold, ...type.h2 },
  statSub: { fontFamily: fonts.semibold, ...type.caption },
  statLabel: { fontFamily: fonts.text, ...type.caption },

  obsItem: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, alignItems: "flex-start" },
  obsText: { fontFamily: fonts.text, ...type.body },
  obsDisclaimer: { fontFamily: fonts.text, ...type.caption, fontStyle: "italic", marginTop: spacing.xs },

  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  recordRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.xs },
  recordLabel: { fontFamily: fonts.text, ...type.bodySmall, flex: 1, textTransform: "uppercase" },
  recordValue: { fontFamily: fonts.bold, ...type.body, marginRight: spacing.md },
  recordDate: { fontFamily: fonts.text, ...type.caption },

  raceHeader: { flexDirection: "row", alignItems: "center" },
  raceName: { fontFamily: fonts.bold, ...type.body },
  raceType: { fontFamily: fonts.text, ...type.caption },
  raceResult: { fontFamily: fonts.text, ...type.bodySmall, marginTop: spacing.xs },
  retroSection: { marginTop: spacing.sm },
  retroStars: { fontFamily: fonts.bold, ...type.h2 },
  retroTime: { fontFamily: fonts.semibold, ...type.body, marginTop: spacing.xs },
  retroPlacement: { fontFamily: fonts.text, ...type.bodySmall },
});
