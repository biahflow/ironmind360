import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { spacing, fonts, radius, type } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { Screen, Overline, Input, PrimaryButton } from "@/src/components/ui";

export default function Login() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email || !password) {
      setError("Preencha email e senha");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await login(email.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e.message || "Falha no login");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAwareScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: spacing.xl,
          paddingTop: insets.top + spacing["5xl"],
          paddingBottom: insets.bottom + spacing["2xl"],
        }}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.emblem, { backgroundColor: colors.accentMuted }]}>
          <Ionicons name="barbell" size={28} color={colors.accent} />
        </View>

        <Overline color={colors.accent}>Sua jornada começa aqui</Overline>
        <Text style={[s.logo, { color: colors.text }]}>IRONMIND 360</Text>
        <Text style={[s.sub, { color: colors.textSecondary }]}>
          Acompanhe treino, nutrição e saúde em um só lugar.
        </Text>

        <View style={s.form}>
          <Input
            testID="login-email-input"
            icon="mail-outline"
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            testID="login-password-input"
            icon="lock-closed-outline"
            placeholder="Senha"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error ? <Text style={[s.error, { color: colors.error }]} testID="login-error">{error}</Text> : null}

          <PrimaryButton
            testID="login-submit-button"
            label="Entrar"
            onPress={submit}
            loading={busy}
            style={s.btn}
          />

          <Pressable testID="go-register-button" onPress={() => router.push("/register")} style={s.linkRow}>
            <Text style={[s.linkMuted, { color: colors.textSecondary }]}>Ainda não tem conta? </Text>
            <Text style={[s.link, { color: colors.accent }]}>Criar conta</Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  emblem: {
    width: 56, height: 56, borderRadius: radius.card,
    alignItems: "center", justifyContent: "center",
    marginBottom: spacing.xl,
  },
  logo: { fontFamily: fonts.bold, ...type.display, marginTop: spacing.xs },
  sub: { fontFamily: fonts.text, ...type.body, marginTop: spacing.sm, marginBottom: spacing["3xl"], lineHeight: 22 },
  form: { gap: spacing.lg },
  error: { fontFamily: fonts.text, ...type.bodySmall },
  btn: { marginTop: spacing.sm },
  linkRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.md },
  linkMuted: { fontFamily: fonts.text, ...type.bodySmall },
  link: { fontFamily: fonts.bold, ...type.bodySmall },
});
