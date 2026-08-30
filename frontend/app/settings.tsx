import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { spacing, radius, fonts, type } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { Screen, IconButton, Overline, PrimaryButton, SecondaryButton } from "@/src/components/ui";

export default function Settings() {
  const { colors, isDark, setMode } = useTheme();
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
      const res = await api.put("/settings", payload);
      setConnected(res.intervals_connected);
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

  const cardStyle = [
    s.card,
    { backgroundColor: colors.surface, borderColor: colors.border },
  ];

  const inputFieldStyle = [
    s.input,
    { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border },
  ];

  return (
    <Screen>
      <View style={[s.header, { paddingTop: insets.top + spacing.md }]}>
        <IconButton testID="settings-back" icon="chevron-back" onPress={() => router.back()} size={20} color={colors.text} />
        <Text style={[s.title, { color: colors.text }]}>Configurações</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ paddingHorizontal: spacing["2xl"], paddingBottom: insets.bottom + spacing["3xl"] }}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        {/* Theme toggle */}
        <Overline style={s.section}>APARÊNCIA</Overline>
        <View style={cardStyle}>
          <View style={s.themeInner}>
            <Text style={[s.themeLabel, { color: colors.text }]}>Tema</Text>
            <View style={s.themeChips}>
              <Pressable
                testID="theme-dark"
                style={[
                  s.themeChip,
                  {
                    backgroundColor: isDark ? colors.accent : colors.surface,
                    borderColor: isDark ? colors.accent : colors.border,
                  },
                ]}
                onPress={() => setMode("dark")}
              >
                <Ionicons name="moon" size={14} color={isDark ? colors.onAccent : colors.textSecondary} />
                <Text style={[s.themeChipText, { color: isDark ? colors.onAccent : colors.textSecondary }]}>Escuro</Text>
              </Pressable>
              <Pressable
                testID="theme-light"
                style={[
                  s.themeChip,
                  {
                    backgroundColor: !isDark ? colors.accent : colors.surface,
                    borderColor: !isDark ? colors.accent : colors.border,
                  },
                ]}
                onPress={() => setMode("light")}
              >
                <Ionicons name="sunny" size={14} color={!isDark ? colors.onAccent : colors.textSecondary} />
                <Text style={[s.themeChipText, { color: !isDark ? colors.onAccent : colors.textSecondary }]}>Claro</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <Overline style={s.section}>PERFIL</Overline>
        <Field label="Nome" colors={colors}>
          <TextInput testID="settings-name-input" style={inputFieldStyle} value={name} onChangeText={setName} placeholderTextColor={colors.textSecondary} />
        </Field>

        <Overline style={s.section}>INTERVALS.ICU</Overline>
        <View style={[
          s.statusBox,
          {
            backgroundColor: connected ? "rgba(46,204,113,0.1)" : colors.surface,
            borderColor: colors.border,
          },
        ]}>
          <View style={[s.statusIcon, { backgroundColor: connected ? "rgba(46,204,113,0.2)" : "rgba(245,166,35,0.2)" }]}>
            <Ionicons name={connected ? "checkmark-circle" : "alert-circle"} size={18} color={connected ? colors.success : colors.warning} />
          </View>
          <Text style={[s.statusText, { color: colors.text }]}>{connected ? "Conta conectada" : "Não conectado"}</Text>
        </View>
        <Text style={[s.help, { color: colors.textSecondary }]}>
          Pegue sua API Key em intervals.icu → Settings → Developer Settings. Cole abaixo (deixe o Athlete ID como 0).
        </Text>
        <Field label="API Key" colors={colors}>
          <TextInput
            testID="settings-apikey-input"
            style={inputFieldStyle}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder={connected ? "•••••••• (já salva) — cole para alterar" : "Cole sua API Key aqui"}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            secureTextEntry
          />
        </Field>
        <Field label="Athlete ID" colors={colors}>
          <TextInput testID="settings-athlete-input" style={inputFieldStyle} value={athleteId} onChangeText={setAthleteId} placeholderTextColor={colors.textSecondary} />
        </Field>

        <Overline style={s.section}>METAS DIÁRIAS</Overline>
        <View style={s.goalGrid}>
          <GoalField label="Calorias (kcal)" value={String(goals.calories)} onChange={(v: string) => setGoal("calories", v)} testID="goal-calories" colors={colors} />
          <GoalField label="Proteína (g)" value={String(goals.protein)} onChange={(v: string) => setGoal("protein", v)} testID="goal-protein" colors={colors} />
          <GoalField label="Água (ml)" value={String(goals.water_ml)} onChange={(v: string) => setGoal("water_ml", v)} testID="goal-water" colors={colors} />
          <GoalField label="Sono (h)" value={String(goals.sleep_hours)} onChange={(v: string) => setGoal("sleep_hours", v)} testID="goal-sleep" colors={colors} />
        </View>

        {err ? <Text style={[s.err, { color: colors.error }]}>{err}</Text> : null}

        <PrimaryButton
          testID="settings-save-button"
          label={saved ? "Salvo ✓" : "Salvar"}
          onPress={save}
          loading={saving}
          style={s.saveBtn}
        />

        <SecondaryButton
          testID="logout-button"
          label="Sair da conta"
          icon="log-out-outline"
          color={colors.error}
          onPress={doLogout}
          style={s.logoutBtn}
        />
      </KeyboardAwareScrollView>
    </Screen>
  );
}

function Field({ label, children, colors }: any) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      {children}
    </View>
  );
}

function GoalField({ label, value, onChange, testID, colors }: any) {
  return (
    <View style={s.goalField}>
      <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        testID={testID}
        style={[s.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        placeholderTextColor={colors.textSecondary}
      />
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing["2xl"], paddingBottom: spacing.xl,
  },
  title: { fontFamily: fonts.bold, ...type.h1 },
  section: { marginTop: spacing["2xl"], marginBottom: spacing.lg },

  card: { borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1 },
  themeInner: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  themeLabel: { fontFamily: fonts.semibold, ...type.body },
  themeChips: { flexDirection: "row", gap: spacing.sm },
  themeChip: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderRadius: radius.pill, borderWidth: 1,
  },
  themeChipText: { fontFamily: fonts.semibold, ...type.bodySmall },

  fieldLabel: { fontFamily: fonts.semibold, ...type.bodySmall, marginBottom: spacing.sm },
  input: {
    borderRadius: radius.lg, paddingHorizontal: spacing.xl, height: 56,
    fontFamily: fonts.text, ...type.body, borderWidth: 1,
  },
  statusBox: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.lg, borderRadius: radius.lg, marginBottom: spacing.md, borderWidth: 1,
  },
  statusIcon: {
    width: 36, height: 36, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
  },
  statusText: { fontFamily: fonts.semibold, ...type.bodySmall },
  help: { fontFamily: fonts.text, ...type.bodySmall, lineHeight: 20, marginBottom: spacing.lg },
  goalGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.lg },
  goalField: { width: "47%", flexGrow: 1 },
  err: { fontFamily: fonts.text, ...type.bodySmall, marginTop: spacing.md },
  saveBtn: { marginTop: spacing["2xl"] },
  logoutBtn: { marginTop: spacing.lg },
});
