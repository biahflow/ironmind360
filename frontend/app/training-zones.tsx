import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";

import { spacing, radius, fonts, type } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/lib/api";
import { Screen, ScreenHeader, Input, PrimaryButton, Overline, LoadingState } from "@/src/components/ui";

function paceToSec(p?: string): number | null {
  if (!p || !/^\d{1,2}:\d{2}$/.test(p)) return null;
  const [m, s] = p.split(":").map(Number);
  return m * 60 + s;
}
function secToPace(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const POWER_ZONES = [
  { z: "Z1", name: "Recuperação", lo: 0, hi: 0.55 },
  { z: "Z2", name: "Endurance", lo: 0.56, hi: 0.75 },
  { z: "Z3", name: "Tempo", lo: 0.76, hi: 0.90 },
  { z: "Z4", name: "Limiar", lo: 0.91, hi: 1.05 },
  { z: "Z5", name: "VO2 máx", lo: 1.06, hi: 1.20 },
  { z: "Z6", name: "Anaeróbio", lo: 1.21, hi: 1.50 },
  { z: "Z7", name: "Neuromuscular", lo: 1.51, hi: 0 },
];
const HR_ZONES = [
  { z: "Z1", name: "Recuperação", lo: 0, hi: 0.85 },
  { z: "Z2", name: "Aeróbico", lo: 0.85, hi: 0.89 },
  { z: "Z3", name: "Tempo", lo: 0.90, hi: 0.94 },
  { z: "Z4", name: "Limiar", lo: 0.95, hi: 0.99 },
  { z: "Z5", name: "VO2 máx", lo: 1.0, hi: 0 },
];
// Pace: multiplicadores do tempo de limiar (maior = mais lento).
const PACE_ZONES = [
  { z: "Z1", name: "Fácil", lo: 1.15, hi: 1.30 },
  { z: "Z2", name: "Endurance", lo: 1.06, hi: 1.15 },
  { z: "Z3", name: "Tempo", lo: 1.00, hi: 1.06 },
  { z: "Z4", name: "Limiar", lo: 0.97, hi: 1.00 },
  { z: "Z5", name: "VO2 máx", lo: 0.90, hi: 0.97 },
];

export default function TrainingZones() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ftp, setFtp] = useState("");
  const [lthr, setLthr] = useState("");
  const [maxhr, setMaxhr] = useState("");
  const [pace, setPace] = useState("");

  const load = useCallback(async () => {
    try {
      const t = await api.get("/profile/thresholds");
      setFtp(t.ftp_watts ? String(t.ftp_watts) : "");
      setLthr(t.lthr_bpm ? String(t.lthr_bpm) : "");
      setMaxhr(t.max_hr_bpm ? String(t.max_hr_bpm) : "");
      setPace(t.threshold_pace_per_km || "");
    } catch {} finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/profile/thresholds", {
        ftp_watts: ftp ? parseInt(ftp) : null,
        lthr_bpm: lthr ? parseInt(lthr) : null,
        max_hr_bpm: maxhr ? parseInt(maxhr) : null,
        threshold_pace_per_km: /^\d{1,2}:\d{2}$/.test(pace) ? pace : null,
      });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch {} finally { setSaving(false); }
  };

  if (loading) {
    return (<Screen><ScreenHeader title="Zonas de treino" onBack={() => router.back()} /><LoadingState full /></Screen>);
  }

  const ftpN = parseInt(ftp) || 0;
  const lthrN = parseInt(lthr) || Math.round((parseInt(maxhr) || 0) * 0.92);
  const paceSec = paceToSec(pace);

  return (
    <Screen>
      <ScreenHeader title="Zonas de treino" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing["3xl"], gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text style={[s.help, { color: colors.textSecondary }]}>
          Informe seus limiares para calcular as zonas. Você encontra esses valores em testes ou no intervals.icu.
        </Text>

        <View style={s.row}>
          <Input containerStyle={{ flex: 1 }} label="FTP (W)" placeholder="210" keyboardType="numeric" value={ftp} onChangeText={setFtp} />
          <Input containerStyle={{ flex: 1 }} label="Pace limiar /km" placeholder="4:30" value={pace} onChangeText={setPace} />
        </View>
        <View style={s.row}>
          <Input containerStyle={{ flex: 1 }} label="FC limiar (bpm)" placeholder="165" keyboardType="numeric" value={lthr} onChangeText={setLthr} />
          <Input containerStyle={{ flex: 1 }} label="FC máx (bpm)" placeholder="190" keyboardType="numeric" value={maxhr} onChangeText={setMaxhr} />
        </View>
        <PrimaryButton label={saved ? "Salvo" : "Salvar limiares"} icon={saved ? "checkmark" : undefined} onPress={save} loading={saving} />

        {ftpN > 0 && (
          <ZoneTable title="Potência (bike) · % FTP" colors={colors} rows={POWER_ZONES.map((z) => ({
            z: z.z, name: z.name,
            range: z.hi ? `${Math.round(z.lo * ftpN)}–${Math.round(z.hi * ftpN)} W` : `>${Math.round(z.lo * ftpN)} W`,
          }))} />
        )}
        {lthrN > 0 && (
          <ZoneTable title="Frequência cardíaca · % FC limiar" colors={colors} rows={HR_ZONES.map((z) => ({
            z: z.z, name: z.name,
            range: z.hi ? `${Math.round(z.lo * lthrN)}–${Math.round(z.hi * lthrN)} bpm` : `>${Math.round(z.lo * lthrN)} bpm`,
          }))} />
        )}
        {paceSec && (
          <ZoneTable title="Pace (corrida) /km" colors={colors} rows={PACE_ZONES.map((z) => ({
            z: z.z, name: z.name,
            range: `${secToPace(paceSec * z.hi)}–${secToPace(paceSec * z.lo)}`,
          }))} />
        )}

        {ftpN === 0 && lthrN === 0 && !paceSec && (
          <Text style={[s.help, { color: colors.textSecondary, textAlign: "center", marginTop: spacing.lg }]}>
            Preencha ao menos um limiar acima para ver as zonas.
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}

function ZoneTable({ title, rows, colors }: any) {
  return (
    <View>
      <Overline color={colors.accent} style={{ marginBottom: spacing.sm }}>{title}</Overline>
      <View style={[s.table, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {rows.map((r: any, i: number) => (
          <View key={r.z} style={[s.zRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
            <View style={[s.zBadge, { backgroundColor: colors.elevated }]}>
              <Text style={[s.zBadgeText, { color: colors.accent }]}>{r.z}</Text>
            </View>
            <Text style={[s.zName, { color: colors.text }]}>{r.name}</Text>
            <Text style={[s.zRange, { color: colors.textSecondary }]}>{r.range}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  help: { fontFamily: fonts.text, ...type.bodySmall, lineHeight: 19 },
  row: { flexDirection: "row", gap: spacing.md },
  table: { borderRadius: radius.card, borderWidth: 1, overflow: "hidden" },
  zRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  zBadge: { width: 34, height: 26, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  zBadgeText: { fontFamily: fonts.bold, ...type.caption },
  zName: { fontFamily: fonts.semibold, ...type.bodySmall, flex: 1 },
  zRange: { fontFamily: fonts.medium, ...type.bodySmall, fontVariant: ["tabular-nums"] },
});
