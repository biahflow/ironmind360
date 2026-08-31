import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { spacing, radius, fonts, type } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/lib/api";
import {
  Screen, ScreenHeader, Card, PillTabs, Overline, Input, PrimaryButton, LoadingState,
} from "@/src/components/ui";

type Tab = "checklist" | "strategy" | "retro";

const RACE_TYPE_LABEL: Record<string, string> = {
  sprint: "Sprint", olympic: "Olímpico", half_ironman: "70.3", ironman: "Ironman", custom: "Prova",
};
const CATEGORY_LABEL: Record<string, string> = {
  documents: "Documentos", equipment: "Equipamento", nutrition: "Nutrição",
  transition: "Transição", logistics: "Logística", general: "Geral",
};

function daysUntil(dateStr?: string): number | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const [y, m, d] = dateStr.split("-").map(Number);
  const t1 = new Date(y, m - 1, d).getTime();
  return Math.round((t1 - t0) / 86400000);
}

function racePhase(days: number) {
  if (days < 0) return { label: "Prova realizada", tip: "Registre sua retrospectiva para aprender com ela." };
  if (days === 0) return { label: "É hoje! 🏁", tip: "Café leve e familiar, hidrate bem e faça o aquecimento. Confie no plano." };
  if (days <= 3) return { label: "Ajuste final", tip: "Carbo-load nos últimos 2-3 dias, capriche na hidratação e no sono. Nada novo agora." };
  if (days <= 7) return { label: "Semana de taper", tip: "Reduza o volume ~40%, mantendo tiros curtos de intensidade. Priorize recuperação." };
  if (days <= 21) return { label: "Pico de forma", tip: "Treinos específicos da prova (pace/altimetria). Simule nutrição de prova nos longos." };
  return { label: "Base / construção", tip: "Construa consistência e volume progressivo. Ainda há tempo de evoluir." };
}

export default function RaceDetail() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; name?: string; type?: string; date?: string }>();
  const id = params.id;
  const [tab, setTab] = useState<Tab>("checklist");

  if (!id) {
    return (
      <Screen>
        <ScreenHeader title="Prova" onBack={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title={params.name || "Prova"}
        subtitle={[RACE_TYPE_LABEL[params.type || ""] || params.type, params.date].filter(Boolean).join(" · ")}
        onBack={() => router.back()}
      />
      {(() => {
        const days = daysUntil(params.date);
        if (days === null) return null;
        const phase = racePhase(days);
        const done = days < 0;
        return (
          <View style={[cd.card, { backgroundColor: colors.surface, borderColor: colors.border, marginHorizontal: spacing.xl }]}>
            <View style={[cd.badge, { backgroundColor: done ? colors.elevated : colors.accentMuted }]}>
              <Text style={[cd.badgeNum, { color: done ? colors.textSecondary : colors.accent }]}>
                {done ? "✓" : days === 0 ? "0" : days}
              </Text>
              <Text style={[cd.badgeUnit, { color: done ? colors.textSecondary : colors.accent }]}>
                {done ? "" : days === 1 ? "dia" : "dias"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[cd.phase, { color: colors.text }]}>{phase.label}</Text>
              <Text style={[cd.tip, { color: colors.textSecondary }]}>{phase.tip}</Text>
            </View>
          </View>
        );
      })()}
      <PillTabs<Tab>
        tabs={[
          { key: "checklist", label: "Checklist" },
          { key: "strategy", label: "Estratégia" },
          { key: "retro", label: "Retrospectiva" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "checklist" && <ChecklistTab raceId={id} colors={colors} insets={insets} />}
      {tab === "strategy" && <StrategyTab raceId={id} colors={colors} insets={insets} />}
      {tab === "retro" && <RetrospectiveTab raceId={id} colors={colors} insets={insets} />}
    </Screen>
  );
}

// ── Checklist ──────────────────────────────────────────────────
function ChecklistTab({ raceId, colors, insets }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const d = await api.get(`/races/${raceId}/checklist`);
      setItems(d.checklist || []);
    } catch {} finally { setLoading(false); }
  }, [raceId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = async (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, checked: !it.checked } : it)));
    try {
      const d = await api.put(`/races/${raceId}/checklist/${index}/toggle`);
      setItems(d.checklist || []);
    } catch { load(); }
  };

  if (loading) return <LoadingState />;

  const grouped: Record<string, { item: any; index: number }[]> = {};
  items.forEach((item, index) => {
    const cat = item.category || "general";
    (grouped[cat] = grouped[cat] || []).push({ item, index });
  });
  const done = items.filter((i) => i.checked).length;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing["3xl"] }}>
      <Text style={[s.progress, { color: colors.textSecondary }]}>{done}/{items.length} concluídos</Text>
      {Object.entries(grouped).map(([cat, entries]) => (
        <View key={cat} style={{ marginTop: spacing.lg }}>
          <Overline color={colors.accent}>{CATEGORY_LABEL[cat] || cat}</Overline>
          <Card style={{ marginTop: spacing.sm, padding: spacing.sm }}>
            {entries.map(({ item, index }) => (
              <Pressable
                key={index}
                onPress={() => toggle(index)}
                style={({ pressed }) => [s.checkRow, pressed && { opacity: 0.7 }]}
              >
                <Ionicons
                  name={item.checked ? "checkmark-circle" : "ellipse-outline"}
                  size={22}
                  color={item.checked ? colors.accent : colors.textSecondary}
                />
                <Text style={[
                  s.checkText,
                  { color: colors.text },
                  item.checked && { color: colors.textSecondary, textDecorationLine: "line-through" },
                ]}>
                  {item.text}
                </Text>
              </Pressable>
            ))}
          </Card>
        </View>
      ))}
    </ScrollView>
  );
}

// ── Estratégia ─────────────────────────────────────────────────
function StrategyTab({ raceId, colors, insets }: any) {
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.get(`/races/${raceId}/strategy`);
      setForm(d.strategy || {});
    } catch { setForm({}); }
  }, [raceId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const payload: any = {
        swim_pace_per_100m: form.swim_pace_per_100m || null,
        bike_power_watts: form.bike_power_watts ? parseInt(String(form.bike_power_watts)) : null,
        run_pace_per_km: form.run_pace_per_km || null,
        fueling_plan: form.fueling_plan || "",
        hydration_plan: form.hydration_plan || "",
        transition_notes: form.transition_notes || "",
        warm_up: form.warm_up || "",
        mental_notes: form.mental_notes || "",
        notes: form.notes || "",
      };
      const d = await api.put(`/races/${raceId}/strategy`, payload);
      setForm(d.strategy || payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch {} finally { setSaving(false); }
  };

  if (!form) return <LoadingState />;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing["3xl"], gap: spacing.lg }} keyboardShouldPersistTaps="handled">
      <View style={s.row}>
        <Input containerStyle={{ flex: 1 }} label="Pace natação /100m" placeholder="1:45" value={form.swim_pace_per_100m || ""} onChangeText={(v: string) => set("swim_pace_per_100m", v)} />
        <Input containerStyle={{ flex: 1 }} label="Potência bike (W)" placeholder="210" keyboardType="numeric" value={form.bike_power_watts ? String(form.bike_power_watts) : ""} onChangeText={(v: string) => set("bike_power_watts", v)} />
      </View>
      <Input label="Pace corrida /km" placeholder="4:50" value={form.run_pace_per_km || ""} onChangeText={(v: string) => set("run_pace_per_km", v)} />
      <MultilineField label="Plano de nutrição" value={form.fueling_plan} onChange={(v: string) => set("fueling_plan", v)} colors={colors} />
      <MultilineField label="Plano de hidratação" value={form.hydration_plan} onChange={(v: string) => set("hydration_plan", v)} colors={colors} />
      <MultilineField label="Transições (T1/T2)" value={form.transition_notes} onChange={(v: string) => set("transition_notes", v)} colors={colors} />
      <MultilineField label="Aquecimento" value={form.warm_up} onChange={(v: string) => set("warm_up", v)} colors={colors} />
      <MultilineField label="Mental / mantras" value={form.mental_notes} onChange={(v: string) => set("mental_notes", v)} colors={colors} />
      <PrimaryButton label={saved ? "Salvo" : "Salvar estratégia"} icon={saved ? "checkmark" : undefined} onPress={save} loading={saving} />
    </ScrollView>
  );
}

// ── Retrospectiva ──────────────────────────────────────────────
function RetrospectiveTab({ raceId, colors, insets }: any) {
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.get(`/races/${raceId}/retrospective`);
      setForm(d.retrospective && Object.keys(d.retrospective).length ? d.retrospective : { overall_rating: 4 });
    } catch { setForm({ overall_rating: 4 }); }
  }, [raceId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        overall_rating: form.overall_rating || 4,
        finish_time: form.finish_time || null,
        placement: form.placement || null,
        swim_notes: form.swim_notes || "",
        bike_notes: form.bike_notes || "",
        run_notes: form.run_notes || "",
        nutrition_notes: form.nutrition_notes || "",
        what_went_well: form.what_went_well || "",
        what_to_improve: form.what_to_improve || "",
      };
      const d = await api.put(`/races/${raceId}/retrospective`, payload);
      setForm(d.retrospective || payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch {} finally { setSaving(false); }
  };

  if (!form) return <LoadingState />;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing["3xl"], gap: spacing.lg }} keyboardShouldPersistTaps="handled">
      <View>
        <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>AVALIAÇÃO GERAL</Text>
        <View style={s.stars}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => set("overall_rating", n)} hitSlop={6}>
              <Ionicons name={n <= (form.overall_rating || 0) ? "star" : "star-outline"} size={30} color={colors.accent} />
            </Pressable>
          ))}
        </View>
      </View>
      <View style={s.row}>
        <Input containerStyle={{ flex: 1 }} label="Tempo final" placeholder="2:28:10" value={form.finish_time || ""} onChangeText={(v: string) => set("finish_time", v)} />
        <Input containerStyle={{ flex: 1 }} label="Colocação" placeholder="12º / AG" value={form.placement || ""} onChangeText={(v: string) => set("placement", v)} />
      </View>
      <MultilineField label="O que foi bem" value={form.what_went_well} onChange={(v: string) => set("what_went_well", v)} colors={colors} />
      <MultilineField label="O que melhorar" value={form.what_to_improve} onChange={(v: string) => set("what_to_improve", v)} colors={colors} />
      <MultilineField label="Natação" value={form.swim_notes} onChange={(v: string) => set("swim_notes", v)} colors={colors} />
      <MultilineField label="Ciclismo" value={form.bike_notes} onChange={(v: string) => set("bike_notes", v)} colors={colors} />
      <MultilineField label="Corrida" value={form.run_notes} onChange={(v: string) => set("run_notes", v)} colors={colors} />
      <MultilineField label="Nutrição" value={form.nutrition_notes} onChange={(v: string) => set("nutrition_notes", v)} colors={colors} />
      <PrimaryButton label={saved ? "Salvo" : "Salvar retrospectiva"} icon={saved ? "checkmark" : undefined} onPress={save} loading={saving} />
    </ScrollView>
  );
}

function MultilineField({ label, value, onChange, colors }: any) {
  return (
    <View>
      <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>{label.toUpperCase()}</Text>
      <TextInput
        style={[s.multiline, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
        value={value || ""}
        onChangeText={onChange}
        placeholder="—"
        placeholderTextColor={colors.textSecondary}
        multiline
      />
    </View>
  );
}

const cd = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center", gap: spacing.lg,
    borderRadius: radius.card, borderWidth: 1, padding: spacing.lg, marginBottom: spacing.md,
  },
  badge: {
    width: 64, height: 64, borderRadius: radius.lg,
    alignItems: "center", justifyContent: "center",
  },
  badgeNum: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 28, fontVariant: ["tabular-nums"] },
  badgeUnit: { fontFamily: fonts.medium, ...type.caption },
  phase: { fontFamily: fonts.bold, ...type.body },
  tip: { fontFamily: fonts.text, ...type.bodySmall, marginTop: 3, lineHeight: 18 },
});

const s = StyleSheet.create({
  progress: { fontFamily: fonts.medium, ...type.bodySmall },
  checkRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.sm },
  checkText: { fontFamily: fonts.medium, ...type.body, flex: 1 },
  row: { flexDirection: "row", gap: spacing.md },
  fieldLabel: {
    fontFamily: fonts.semibold, ...type.caption, letterSpacing: 1,
    textTransform: "uppercase", marginBottom: spacing.sm,
  },
  stars: { flexDirection: "row", gap: spacing.md },
  multiline: {
    minHeight: 80, borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg,
    fontFamily: fonts.text, ...type.body, textAlignVertical: "top",
  },
});
