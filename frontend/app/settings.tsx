import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, spacing, radius, fonts, type } from "@/src/theme";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";

export default function Settings() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout, refreshUser } = useAuth();
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [athleteId, setAthleteId] = useState("0");
  const [connected, setConnected] = useState(false);
  const [goals, setGoals] = useState<any>({ calories: 2200, protein: 150, water_ml: 3000, sleep_hours: 7.5 });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const s = await api.get("/settings");
        setName(s.name || "");
        setConnected(s.intervals_connected);
        setAthleteId(s.intervals_athlete_id || "0");
        setGoals(s.goals || goals);
      } catch {}
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    setErr("");
    setSaved(false);
    try {
      const payload: any = { name, intervals_athlete_id: athleteId, goals };
      if (apiKey.trim()) payload.intervals_api_key = apiKey.trim();
      const s = await api.put("/settings", payload);
      setConnected(s.intervals_connected);
      setApiKey("");
      await refreshUser();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setErr(e.message || "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const doLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const setGoal = (k: string, v: string) => {
    const num = parseFloat(v.replace(",", ".")) || 0;
    setGoals((g: any) => ({ ...g, [k]: num }));
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="settings-back" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>CONFIGURAÇÕES</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["3xl"] }}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.section}>PERFIL</Text>
        <Field label="Nome">
          <TextInput testID="settings-name-input" style={styles.input} value={name} onChangeText={setName} placeholderTextColor={colors.onSurfaceSecondary} />
        </Field>

        <Text style={styles.section}>INTERVALS.ICU</Text>
        <View style={[styles.statusBox, connected ? styles.statusOk : styles.statusOff]}>
          <Ionicons name={connected ? "checkmark-circle" : "alert-circle"} size={18} color={connected ? colors.success : colors.warning} />
          <Text style={styles.statusText}>{connected ? "Conta conectada" : "Não conectado"}</Text>
        </View>
        <Text style={styles.help}>
          Pegue sua API Key em intervals.icu → Settings → Developer Settings. Cole abaixo (deixe o Athlete ID como 0).
        </Text>
        <Field label="API Key">
          <TextInput
            testID="settings-apikey-input"
            style={styles.input}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder={connected ? "•••••••• (já salva) — cole para alterar" : "Cole sua API Key aqui"}
            placeholderTextColor={colors.onSurfaceSecondary}
            autoCapitalize="none"
            secureTextEntry
          />
        </Field>
        <Field label="Athlete ID">
          <TextInput testID="settings-athlete-input" style={styles.input} value={athleteId} onChangeText={setAthleteId} placeholderTextColor={colors.onSurfaceSecondary} />
        </Field>

        <Text style={styles.section}>METAS DIÁRIAS</Text>
        <View style={styles.goalGrid}>
          <GoalField label="Calorias (kcal)" value={String(goals.calories)} onChange={(v: string) => setGoal("calories", v)} testID="goal-calories" />
          <GoalField label="Proteína (g)" value={String(goals.protein)} onChange={(v: string) => setGoal("protein", v)} testID="goal-protein" />
          <GoalField label="Água (ml)" value={String(goals.water_ml)} onChange={(v: string) => setGoal("water_ml", v)} testID="goal-water" />
          <GoalField label="Sono (h)" value={String(goals.sleep_hours)} onChange={(v: string) => setGoal("sleep_hours", v)} testID="goal-sleep" />
        </View>

        {err ? <Text style={styles.err}>{err}</Text> : null}

        <Pressable testID="settings-save-button" style={styles.saveBtn} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.saveText}>{saved ? "SALVO ✓" : "SALVAR"}</Text>}
        </Pressable>

        <Pressable testID="logout-button" style={styles.logoutBtn} onPress={doLogout}>
          <Ionicons name="log-out-outline" size={18} color={colors.error} />
          <Text style={styles.logoutText}>Sair da conta</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

function Field({ label, children }: any) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function GoalField({ label, value, onChange, testID }: any) {
  return (
    <View style={styles.goalField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput testID={testID} style={styles.input} value={value} onChangeText={onChange} keyboardType="numeric" placeholderTextColor={colors.onSurfaceSecondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider,
  },
  back: { width: 40, height: 40, justifyContent: "center" },
  title: { fontFamily: fonts.display, fontSize: type["2xl"], color: colors.onSurface, letterSpacing: 1 },
  section: { fontFamily: fonts.bold, fontSize: type.sm, color: colors.onSurfaceSecondary, letterSpacing: 2, marginTop: spacing.xl, marginBottom: spacing.md },
  fieldLabel: { fontFamily: fonts.medium, fontSize: type.sm, color: colors.onSurfaceSecondary, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 52,
    color: colors.onSurface, fontFamily: fonts.text, fontSize: type.lg,
  },
  statusBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1 },
  statusOk: { backgroundColor: "rgba(46,139,87,0.1)", borderColor: colors.success },
  statusOff: { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
  statusText: { fontFamily: fonts.semibold, fontSize: type.base, color: colors.onSurface },
  help: { fontFamily: fonts.text, fontSize: type.sm, color: colors.onSurfaceSecondary, lineHeight: 20, marginBottom: spacing.md },
  goalGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  goalField: { width: "47%", flexGrow: 1 },
  err: { fontFamily: fonts.medium, fontSize: type.base, color: colors.error, marginTop: spacing.md },
  saveBtn: { backgroundColor: colors.brandPrimary, height: 56, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginTop: spacing.xl },
  saveText: { fontFamily: fonts.bold, fontSize: type.lg, color: colors.onBrandPrimary, letterSpacing: 1 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.lg, height: 52 },
  logoutText: { fontFamily: fonts.semibold, fontSize: type.base, color: colors.error },
});
