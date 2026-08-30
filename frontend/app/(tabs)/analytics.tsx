import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { spacing, fonts, type } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/lib/api";
import {
  Screen, ScreenHeader, Card, PillTabs, Overline, EmptyState,
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

  if (loading) {
    return <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />;
  }

  return (
    <ScrollView contentContainerStyle={s.content}>
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

  if (loading) return <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />;

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
    <ScrollView contentContainerStyle={s.content}>
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

function RacesTab() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [races, setRaces] = useState<any[]>([]);

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

  if (loading) return <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />;

  const raceTypeLabel: Record<string, string> = {
    sprint: "Sprint", olympic: "Olímpico",
    half_ironman: "70.3", ironman: "Ironman", custom: "Custom",
  };

  const stars = (rating: number) => "★".repeat(rating) + "☆".repeat(5 - rating);

  return (
    <ScrollView contentContainerStyle={s.content}>
      {races.length === 0 ? (
        <EmptyState icon="flag-outline" title="Nenhuma prova registrada" text="Adicione provas na aba de Calendário." />
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

const s = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.md, paddingBottom: 120 },

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
