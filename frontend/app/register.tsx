import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import * as Haptics from "expo-haptics";

import { spacing, fonts, type } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { Screen, IconButton, Overline, Input, PrimaryButton } from "@/src/components/ui";

export default function Register() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name || !email || password.length < 6) {
      setError("Nome, email e senha (mín. 6 caracteres) são obrigatórios");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await register(email.trim(), password, name.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/onboarding");
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e.message || "Falha no cadastro");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: insets.top + spacing["2xl"], paddingBottom: insets.bottom + spacing["2xl"] }}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.backRow}>
          <IconButton testID="back-button" icon="chevron-back" onPress={() => router.back()} size={20} color={colors.text} />
        </View>

        <View style={s.brandArea}>
          <Overline color={colors.accent}>Vamos começar</Overline>
          <Text style={[s.title, { color: colors.text }]}>CRIE SUA{"\n"}CONTA</Text>
          <Text style={[s.sub, { color: colors.textSecondary }]}>Crie sua conta e comece a acompanhar seu desempenho.</Text>
        </View>

        <View style={s.form}>
          <Input
            testID="register-name-input"
            icon="person-outline"
            placeholder="Como devo te chamar"
            value={name}
            onChangeText={setName}
          />
          <Input
            testID="register-email-input"
            icon="mail-outline"
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            testID="register-password-input"
            icon="lock-closed-outline"
            placeholder="Senha (mín. 6)"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error ? <Text style={[s.error, { color: colors.error }]} testID="register-error">{error}</Text> : null}

            <PrimaryButton
              testID="register-submit-button"
              label="Criar conta"
              onPress={submit}
              loading={busy}
              style={s.btn}
            />

            <Pressable testID="go-login-button" onPress={() => router.replace("/login")} style={s.linkRow}>
              <Text style={[s.linkMuted, { color: colors.textSecondary }]}>Já tem conta? </Text>
              <Text style={[s.link, { color: colors.accent }]}>Entrar</Text>
            </Pressable>
          </View>
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  backRow: { marginBottom: spacing.xl },
  brandArea: { marginBottom: spacing["2xl"] },
  title: { fontFamily: fonts.bold, ...type.display, marginTop: spacing.xs },
  sub: { fontFamily: fonts.text, ...type.body, marginTop: spacing.md, lineHeight: 22 },
  form: { gap: spacing.lg },
  error: { fontFamily: fonts.text, ...type.bodySmall },
  btn: { marginTop: spacing.sm },
  linkRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.md },
  linkMuted: { fontFamily: fonts.text, ...type.bodySmall },
  link: { fontFamily: fonts.bold, ...type.bodySmall },
});
