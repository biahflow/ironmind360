import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable, Platform, Linking, ActivityIndicator, Switch,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";

import { spacing, radius, fonts, type } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { api, authHeaders, fileUrl } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { Screen, IconButton, Overline, PrimaryButton, SecondaryButton } from "@/src/components/ui";

type WearablePermission = { source: string; data_types: string[] };
type WearableSummary = {
  resting_hr: { value: { bpm: number }; date: string } | null;
  hrv: { value: { ms: number }; date: string } | null;
  weight: { value: { kg: number }; date: string } | null;
  last_sleep: { value: { hours: number }; date: string } | null;
  sources_connected: string[];
};

export default function Settings() {
  const { colors, isDark, setMode } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout, refreshUser } = useAuth();
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [imageHeaders, setImageHeaders] = useState<Record<string, string>>({});
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [athleteId, setAthleteId] = useState("0");
  const [connected, setConnected] = useState(false);
  const [goals, setGoals] = useState<any>({ calories: 2200, protein: 150, water_ml: 3000, sleep_hours: 7.5 });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  const [wearablePerms, setWearablePerms] = useState<WearablePermission[]>([]);
  const [wearableSummary, setWearableSummary] = useState<WearableSummary | null>(null);
  const [wearableLoading, setWearableLoading] = useState(false);

  const [prefs, setPrefs] = useState<any>(null);
  const [isProfessional, setIsProfessional] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<{ connected: boolean; charges_enabled: boolean } | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await api.get("/settings");
        setName(s.name || "");
        setAvatarUrl(s.avatar_url || null);
        setConnected(s.intervals_connected);
        setAthleteId(s.intervals_athlete_id || "0");
        setGoals(s.goals || goals);
        const roles: string[] = s.roles || [];
        setIsProfessional(roles.includes("nutritionist") || roles.includes("psychologist"));
      } catch {}
    })();
    (async () => setImageHeaders(await authHeaders()))();
    (async () => { try { setPrefs(await api.get("/notification-preferences")); } catch {} })();
    loadWearables();
  }, []);

  const togglePref = async (key: string) => {
    if (!prefs) return;
    const previous = prefs;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await api.put("/notification-preferences", next);
    } catch {
      setPrefs(previous);
    }
  };

  const pickAvatar = async () => {
    setErr("");
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setErr(perm.canAskAgain ? "Precisamos da galeria para escolher a foto." : "Acesso à galeria bloqueado. Abra as configurações.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1] });
    if (res.canceled || !res.assets?.[0]) return;
    setAvatarBusy(true);
    try {
      const out = await api.uploadImage("/profile/avatar", res.assets[0].uri, "PUT");
      setAvatarUrl(out.avatar_url);
      setImageHeaders(await authHeaders());
      await refreshUser();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setErr(e.message || "Falha ao enviar foto");
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    setAvatarBusy(true);
    try {
      await api.del("/profile/avatar");
      setAvatarUrl(null);
      await refreshUser();
    } catch (e: any) {
      setErr(e.message || "Falha ao remover foto");
    } finally {
      setAvatarBusy(false);
    }
  };

  const loadWearables = async () => {
    try {
      const [perms, summary] = await Promise.all([
        api.get("/wearable-permissions"),
        api.get("/wearable-summary"),
      ]);
      setWearablePerms(perms.permissions || []);
      setWearableSummary(summary);
    } catch {}
  };

  const connectWearable = async (source: "apple_health" | "health_connect") => {
    setWearableLoading(true);
    try {
      await api.put("/wearable-permissions", {
        source,
        data_types: ["sleep", "resting_hr", "hrv", "weight", "activity"],
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadWearables();
    } catch (e: any) {
      setErr(e.message || "Falha ao conectar");
    } finally {
      setWearableLoading(false);
    }
  };

  const disconnectWearable = async (source: string) => {
    setWearableLoading(true);
    try {
      await api.del(`/wearable-permissions/${source}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadWearables();
    } catch (e: any) {
      setErr(e.message || "Falha ao desconectar");
    } finally {
      setWearableLoading(false);
    }
  };

  const loadStripeStatus = async () => {
    try {
      const status = await api.get("/payments/connect/status");
      setStripeStatus(status);
    } catch {}
  };

  useEffect(() => {
    if (isProfessional) loadStripeStatus();
  }, [isProfessional]);

  const startStripeOnboard = async () => {
    setStripeLoading(true);
    try {
      const res = await api.post("/payments/connect/onboard", { country: "BR" });
      if (res.onboarding_url) {
        Linking.openURL(res.onboarding_url);
      }
    } catch (e: any) {
      setErr(e.message || "Falha ao iniciar onboarding Stripe");
    } finally {
      setStripeLoading(false);
    }
  };

  const openStripeDashboard = async () => {
    try {
      const res = await api.post("/payments/connect/dashboard-link");
      if (res.url) Linking.openURL(res.url);
    } catch (e: any) {
      setErr(e.message || "Falha ao abrir painel Stripe");
    }
  };

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
    try {
      await logout();
    } finally {
      router.replace("/login");
    }
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
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing["3xl"] }}
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
        <View style={[s.avatarRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable testID="avatar-picker" onPress={pickAvatar} disabled={avatarBusy} style={[s.avatar, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
            {avatarBusy ? (
              <ActivityIndicator color={colors.accent} />
            ) : avatarUrl ? (
              <Image source={{ uri: fileUrl(avatarUrl), headers: imageHeaders }} style={s.avatarImg} contentFit="cover" />
            ) : (
              <Ionicons name="person" size={28} color={colors.textSecondary} />
            )}
            <View style={[s.avatarEdit, { backgroundColor: colors.accent, borderColor: colors.surface }]}>
              <Ionicons name="camera" size={13} color={colors.onAccent} />
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[s.themeLabel, { color: colors.text }]}>Foto de perfil</Text>
            <View style={s.avatarActions}>
              <Text onPress={pickAvatar} suppressHighlighting style={[s.avatarLink, { color: colors.accent }]}>
                {avatarUrl ? "Alterar" : "Adicionar"}
              </Text>
              {avatarUrl ? (
                <Text onPress={removeAvatar} suppressHighlighting style={[s.avatarLink, { color: colors.textSecondary }]}>Remover</Text>
              ) : null}
            </View>
          </View>
        </View>
        <Field label="Nome" colors={colors}>
          <TextInput testID="settings-name-input" style={inputFieldStyle} value={name} onChangeText={setName} placeholderTextColor={colors.textSecondary} />
        </Field>

        <Overline style={s.section}>INTERVALS.ICU</Overline>
        <View style={[
          s.statusBox,
          {
            backgroundColor: connected ? colors.successMuted : colors.surface,
            borderColor: colors.border,
          },
        ]}>
          <View style={[s.statusIcon, { backgroundColor: connected ? colors.successMuted : colors.warningMuted }]}>
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

        <Overline style={s.section}>SAÚDE E WEARABLES</Overline>
        {(Platform.OS === "ios" || Platform.OS === "web") && (
          <WearableCard
            label="Apple Health"
            source="apple_health"
            icon="logo-apple"
            connected={wearablePerms.some(p => p.source === "apple_health")}
            loading={wearableLoading}
            onConnect={() => connectWearable("apple_health")}
            onDisconnect={() => disconnectWearable("apple_health")}
            colors={colors}
          />
        )}
        {(Platform.OS === "android" || Platform.OS === "web") && (
          <WearableCard
            label="Health Connect"
            source="health_connect"
            icon="fitness"
            connected={wearablePerms.some(p => p.source === "health_connect")}
            loading={wearableLoading}
            onConnect={() => connectWearable("health_connect")}
            onDisconnect={() => disconnectWearable("health_connect")}
            colors={colors}
          />
        )}
        {wearableSummary && (wearableSummary.resting_hr || wearableSummary.hrv || wearableSummary.weight || wearableSummary.last_sleep) && (
          <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[s.themeLabel, { color: colors.text, marginBottom: spacing.md }]}>Últimos dados</Text>
            {wearableSummary.resting_hr && (
              <WearableMetric label="FC repouso" value={`${wearableSummary.resting_hr.value.bpm} bpm`} date={wearableSummary.resting_hr.date} colors={colors} />
            )}
            {wearableSummary.hrv && (
              <WearableMetric label="HRV" value={`${wearableSummary.hrv.value.ms} ms`} date={wearableSummary.hrv.date} colors={colors} />
            )}
            {wearableSummary.weight && (
              <WearableMetric label="Peso" value={`${wearableSummary.weight.value.kg} kg`} date={wearableSummary.weight.date} colors={colors} />
            )}
            {wearableSummary.last_sleep && (
              <WearableMetric label="Sono" value={`${wearableSummary.last_sleep.value.hours}h`} date={wearableSummary.last_sleep.date} colors={colors} />
            )}
          </View>
        )}

        {isProfessional && (
          <>
            <Overline style={s.section}>PAGAMENTOS</Overline>
            <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={s.themeInner}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.themeLabel, { color: colors.text }]}>Stripe Connect</Text>
                  <Text style={[s.help, { color: colors.textSecondary, marginBottom: 0, marginTop: spacing.xs }]}>
                    {stripeStatus?.connected
                      ? stripeStatus.charges_enabled
                        ? "Conta ativa — pronta para receber pagamentos"
                        : "Onboarding em andamento"
                      : "Conecte para receber pagamentos de atletas"}
                  </Text>
                </View>
                <View style={[s.statusIcon, {
                  backgroundColor: stripeStatus?.charges_enabled ? colors.successMuted : colors.warningMuted,
                }]}>
                  <Ionicons
                    name={stripeStatus?.charges_enabled ? "checkmark-circle" : "alert-circle"}
                    size={18}
                    color={stripeStatus?.charges_enabled ? colors.success : colors.warning}
                  />
                </View>
              </View>
              {stripeStatus?.connected ? (
                <SecondaryButton
                  label="Abrir painel Stripe"
                  icon="open-outline"
                  onPress={openStripeDashboard}
                  style={{ marginTop: spacing.lg }}
                />
              ) : (
                <PrimaryButton
                  label="Conectar Stripe"
                  onPress={startStripeOnboard}
                  loading={stripeLoading}
                  style={{ marginTop: spacing.lg }}
                />
              )}
            </View>
          </>
        )}

        {prefs && (
          <>
            <Overline style={s.section}>NOTIFICAÇÕES</Overline>
            <View style={cardStyle}>
              {[
                ["checkin_reminder", "Lembrete de check-in"],
                ["workout_reminder", "Lembrete de treino"],
                ["hydration_reminder", "Lembrete de hidratação"],
                ["meal_reminders", "Lembretes de refeição"],
                ["readiness_alerts", "Alertas de prontidão"],
                ["race_countdown", "Contagem regressiva de provas"],
                ["weekly_summary", "Resumo semanal"],
              ].map(([key, label], i) => (
                <View
                  key={key}
                  style={[
                    s.prefRow,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                  ]}
                >
                  <Text style={[s.themeLabel, { color: colors.text, flex: 1 }]}>{label}</Text>
                  <Switch
                    value={!!prefs[key]}
                    onValueChange={() => togglePref(key)}
                    trackColor={{ false: colors.border, true: colors.accentMuted }}
                    thumbColor={prefs[key] ? colors.accent : colors.textSecondary}
                  />
                </View>
              ))}
            </View>
          </>
        )}

        {err ? <Text style={[s.err, { color: colors.error }]}>{err}</Text> : null}

        <PrimaryButton
          testID="settings-save-button"
          label={saved ? "Salvo" : "Salvar"}
          icon={saved ? "checkmark" : undefined}
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

function WearableCard({ label, source, icon, connected, loading, onConnect, onDisconnect, colors }: any) {
  return (
    <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: spacing.md }]}>
      <View style={s.themeInner}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 }}>
          <View style={[s.statusIcon, { backgroundColor: connected ? colors.successMuted : colors.warningMuted }]}>
            <Ionicons name={icon} size={18} color={connected ? colors.success : colors.textSecondary} />
          </View>
          <View>
            <Text style={[s.themeLabel, { color: colors.text }]}>{label}</Text>
            <Text style={[{ fontFamily: fonts.text, ...type.caption, color: colors.textSecondary }]}>
              {connected ? "Conectado" : "Desconectado"}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={connected ? onDisconnect : onConnect}
          disabled={loading}
          style={[
            s.themeChip,
            {
              backgroundColor: connected ? colors.errorMuted : colors.accentMuted,
              borderColor: connected ? colors.error : colors.accent,
            },
          ]}
        >
          <Text style={[s.themeChipText, { color: connected ? colors.error : colors.accent }]}>
            {connected ? "Desconectar" : "Conectar"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function WearableMetric({ label, value, date, colors }: any) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.xs }}>
      <Text style={{ fontFamily: fonts.text, ...type.bodySmall, color: colors.textSecondary }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
        <Text style={{ fontFamily: fonts.semibold, ...type.body, color: colors.text }}>{value}</Text>
        <Text style={{ fontFamily: fonts.text, ...type.caption, color: colors.textSecondary }}>{date}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingBottom: spacing.xl,
  },
  title: { fontFamily: fonts.bold, ...type.h1 },
  section: { marginTop: spacing["2xl"], marginBottom: spacing.lg },

  card: { borderRadius: radius.card, padding: spacing.xl, borderWidth: 1 },
  avatarRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.lg,
    borderRadius: radius.card, padding: spacing.lg, borderWidth: 1, marginBottom: spacing.lg,
  },
  avatar: {
    width: 64, height: 64, borderRadius: radius.pill, borderWidth: 1,
    alignItems: "center", justifyContent: "center", overflow: "visible",
  },
  avatarImg: { width: 64, height: 64, borderRadius: radius.pill },
  avatarEdit: {
    position: "absolute", right: -2, bottom: -2,
    width: 24, height: 24, borderRadius: radius.pill, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  avatarActions: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.xs },
  avatarLink: { fontFamily: fonts.semibold, ...type.bodySmall },
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
  prefRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: spacing.md, gap: spacing.md,
  },
  err: { fontFamily: fonts.text, ...type.bodySmall, marginTop: spacing.md },
  saveBtn: { marginTop: spacing["2xl"] },
  logoutBtn: { marginTop: spacing.lg },
});
