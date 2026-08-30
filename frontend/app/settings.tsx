import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { spacing, radius, fonts, type, shadow } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";

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
    {
      backgroundColor: colors.cardBackground,
      ...(isDark ? {} : shadow.sm),
    },
  ];

  const inputFieldStyle = [
    s.input,
    {
      backgroundColor: colors.inputBackground,
      color: colors.onSurface,
      ...(isDark ? {} : shadow.sm),
    },
  ];

  return (
    <View style={[s.root, { backgroundColor: colors.surface }]}>
      <View style={[s.header, { paddingTop: insets.top + spacing.md, borderBottomColor: colors.divider }]}>
        <Pressable testID="settings-back" onPress={() => router.back()} style={[s.back, { backgroundColor: colors.surfaceTertiary }]}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={[s.title, { color: colors.onSurface }]}>Configurações</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing["3xl"] }}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        {/* Theme toggle */}
        <Text style={[s.section, { color: colors.onSurfaceSecondary }]}>APARÊNCIA</Text>
        <View style={cardStyle}>
          <View style={s.themeInner}>
            <Text style={[s.themeLabel, { color: colors.onSurface }]}>Tema</Text>
            <View style={s.themeChips}>
              <Pressable
                testID="theme-dark"
                style={[
                  s.themeChip,
                  {
                    backgroundColor: isDark ? colors.brandPrimary : colors.surfaceTertiary,
                    ...(isDark ? shadow.glow(colors.brandPrimary) : {}),
                  },
                ]}
                onPress={() => setMode("dark")}
              >
                <Ionicons name="moon" size={14} color={isDark ? colors.onBrandPrimary : colors.onSurfaceSecondary} />
                <Text style={[s.themeChipText, { color: isDark ? colors.onBrandPrimary : colors.onSurfaceSecondary }]}>Escuro</Text>
              </Pressable>
              <Pressable
                testID="theme-light"
                style={[
                  s.themeChip,
                  {
                    backgroundColor: !isDark ? colors.brandPrimary : colors.surfaceTertiary,
                    ...(!isDark ? shadow.glow(colors.brandPrimary) : {}),
                  },
                ]}
                onPress={() => setMode("light")}
              >
                <Ionicons name="sunny" size={14} color={!isDark ? colors.onBrandPrimary : colors.onSurfaceSecondary} />
                <Text style={[s.themeChipText, { color: !isDark ? colors.onBrandPrimary : colors.onSurfaceSecondary }]}>Claro</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <Text style={[s.section, { color: colors.onSurfaceSecondary }]}>PERFIL</Text>
        <Field label="Nome" colors={colors}>
          <TextInput testID="settings-name-input" style={inputFieldStyle} value={name} onChangeText={setName} placeholderTextColor={colors.onSurfaceSecondary} />
        </Field>

        <Text style={[s.section, { color: colors.onSurfaceSecondary }]}>INTERVALS.ICU</Text>
        <View style={[
          s.statusBox,
          {
            backgroundColor: connected ? "rgba(46,204,113,0.1)" : colors.surfaceTertiary,
            ...(isDark ? {} : shadow.sm),
          },
        ]}>
          <View style={[s.statusIcon, { backgroundColor: connected ? "rgba(46,204,113,0.2)" : "rgba(245,166,35,0.2)" }]}>
            <Ionicons name={connected ? "checkmark-circle" : "alert-circle"} size={18} color={connected ? colors.success : colors.warning} />
          </View>
          <Text style={[s.statusText, { color: colors.onSurface }]}>{connected ? "Conta conectada" : "Não conectado"}</Text>
        </View>
        <Text style={[s.help, { color: colors.onSurfaceSecondary }]}>
          Pegue sua API Key em intervals.icu → Settings → Developer Settings. Cole abaixo (deixe o Athlete ID como 0).
        </Text>
        <Field label="API Key" colors={colors}>
          <TextInput
            testID="settings-apikey-input"
            style={inputFieldStyle}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder={connected ? "•••••••• (já salva) — cole para alterar" : "Cole sua API Key aqui"}
            placeholderTextColor={colors.onSurfaceSecondary}
            autoCapitalize="none"
            secureTextEntry
          />
        </Field>
        <Field label="Athlete ID" colors={colors}>
          <TextInput testID="settings-athlete-input" style={inputFieldStyle} value={athleteId} onChangeText={setAthleteId} placeholderTextColor={colors.onSurfaceSecondary} />
        </Field>

        <Text style={[s.section, { color: colors.onSurfaceSecondary }]}>METAS DIÁRIAS</Text>
        <View style={s.goalGrid}>
          <GoalField label="Calorias (kcal)" value={String(goals.calories)} onChange={(v: string) => setGoal("calories", v)} testID="goal-calories" colors={colors} isDark={isDark} />
          <GoalField label="Proteína (g)" value={String(goals.protein)} onChange={(v: string) => setGoal("protein", v)} testID="goal-protein" colors={colors} isDark={isDark} />
          <GoalField label="Água (ml)" value={String(goals.water_ml)} onChange={(v: string) => setGoal("water_ml", v)} testID="goal-water" colors={colors} isDark={isDark} />
          <GoalField label="Sono (h)" value={String(goals.sleep_hours)} onChange={(v: string) => setGoal("sleep_hours", v)} testID="goal-sleep" colors={colors} isDark={isDark} />
        </View>

        {err ? <Text style={[s.err, { color: colors.error }]}>{err}</Text> : null}

        <Pressable
          testID="settings-save-button"
          style={[s.saveBtn, { backgroundColor: colors.brandPrimary, ...shadow.glow(colors.brandPrimary) }]}
          onPress={save}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={[s.saveText, { color: colors.onBrandPrimary }]}>{saved ? "SALVO ✓" : "SALVAR"}</Text>}
        </Pressable>

        <Pressable testID="logout-button" style={[s.logoutBtn, { backgroundColor: colors.surfaceTertiary }]} onPress={doLogout}>
          <Ionicons name="log-out-outline" size={18} color={colors.error} />
          <Text style={[s.logoutText, { color: colors.error }]}>Sair da conta</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

function Field({ label, children, colors }: any) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={[s.fieldLabel, { color: colors.onSurfaceSecondary }]}>{label}</Text>
      {children}
    </View>
  );
}

function GoalField({ label, value, onChange, testID, colors, isDark }: any) {
  return (
    <View style={s.goalField}>
      <Text style={[s.fieldLabel, { color: colors.onSurfaceSecondary }]}>{label}</Text>
      <TextInput
        testID={testID}
        style={[s.input, { backgroundColor: colors.inputBackground, color: colors.onSurface, ...(isDark ? {} : shadow.sm) }]}
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        placeholderTextColor={colors.onSurfaceSecondary}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: {
    width: 44, height: 44, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontFamily: fonts.display, fontSize: type["2xl"], letterSpacing: 1 },
  section: { fontFamily: fonts.bold, fontSize: type.sm, letterSpacing: 2, marginTop: spacing["2xl"], marginBottom: spacing.lg },

  card: { borderRadius: radius.xl, padding: spacing.xl },
  themeInner: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  themeLabel: { fontFamily: fonts.semibold, fontSize: type.lg },
  themeChips: { flexDirection: "row", gap: spacing.sm },
  themeChip: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  themeChipText: { fontFamily: fonts.bold, fontSize: type.sm },

  fieldLabel: { fontFamily: fonts.semibold, fontSize: type.sm, marginBottom: spacing.sm },
  input: {
    borderRadius: radius.lg, paddingHorizontal: spacing.xl, height: 56,
    fontFamily: fonts.medium, fontSize: type.lg,
  },
  statusBox: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.lg, borderRadius: radius.lg, marginBottom: spacing.md,
  },
  statusIcon: {
    width: 36, height: 36, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
  },
  statusText: { fontFamily: fonts.semibold, fontSize: type.base },
  help: { fontFamily: fonts.medium, fontSize: type.sm, lineHeight: 20, marginBottom: spacing.lg },
  goalGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.lg },
  goalField: { width: "47%", flexGrow: 1 },
  err: { fontFamily: fonts.medium, fontSize: type.base, marginTop: spacing.md },
  saveBtn: {
    height: 56, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center", marginTop: spacing["2xl"],
  },
  saveText: { fontFamily: fonts.bold, fontSize: type.lg, letterSpacing: 1 },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: spacing.sm, marginTop: spacing.lg, height: 52, borderRadius: radius.pill,
  },
  logoutText: { fontFamily: fonts.semibold, fontSize: type.base },
});
