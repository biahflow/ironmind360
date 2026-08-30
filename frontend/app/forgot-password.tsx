import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import * as Haptics from "expo-haptics";

import { spacing, fonts, type } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/lib/api";
import { Screen, IconButton, Overline, Input, PrimaryButton } from "@/src/components/ui";

export default function ForgotPassword() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const requestCode = async () => {
    if (!email.trim()) { setError("Informe seu e-mail."); return; }
    setBusy(true); setError("");
    try {
      await api.post("/auth/password/forgot", { email: email.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMsg("Se este e-mail tiver conta, enviamos um código de recuperação. Cole-o abaixo com a nova senha.");
      setStep("reset");
    } catch (e: any) {
      setError(e?.message || "Não foi possível enviar o código.");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!token.trim()) { setError("Cole o código recebido por e-mail."); return; }
    if (pw.length < 8) { setError("A nova senha precisa ter no mínimo 8 caracteres."); return; }
    if (pw !== pw2) { setError("As senhas não coincidem."); return; }
    setBusy(true); setError("");
    try {
      await api.post("/auth/password/reset", { token: token.trim(), password: pw });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/login");
    } catch (e: any) {
      setError(e?.message || "Código inválido ou expirado.");
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
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing["2xl"],
        }}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.backRow}>
          <IconButton icon="chevron-back" onPress={() => router.back()} size={20} color={colors.text} />
        </View>

        <View style={s.brand}>
          <Overline color={colors.accent}>Recuperar acesso</Overline>
          <Text style={[s.title, { color: colors.text }]}>
            {step === "email" ? "ESQUECEU\nSUA SENHA?" : "REDEFINIR\nSENHA"}
          </Text>
          <Text style={[s.sub, { color: colors.textSecondary }]}>
            {step === "email"
              ? "Enviaremos um código de recuperação para o seu e-mail."
              : "Cole o código do e-mail e defina uma nova senha (mín. 8 caracteres)."}
          </Text>
        </View>

        {msg ? (
          <View style={[s.msgBox, { backgroundColor: colors.accentMuted }]}>
            <Text style={[s.msgText, { color: colors.text }]}>{msg}</Text>
          </View>
        ) : null}

        <View style={s.form}>
          {step === "email" ? (
            <>
              <Input
                testID="forgot-email-input"
                icon="mail-outline"
                placeholder="Seu e-mail"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              {error ? <Text style={[s.error, { color: colors.error }]}>{error}</Text> : null}
              <PrimaryButton testID="forgot-submit" label="Enviar código" onPress={requestCode} loading={busy} style={s.btn} />
            </>
          ) : (
            <>
              <Input
                testID="reset-token-input"
                icon="key-outline"
                placeholder="Código do e-mail"
                autoCapitalize="none"
                value={token}
                onChangeText={setToken}
              />
              <Input
                testID="reset-password-input"
                icon="lock-closed-outline"
                placeholder="Nova senha (mín. 8)"
                secureTextEntry
                value={pw}
                onChangeText={setPw}
              />
              <Input
                testID="reset-password-confirm"
                icon="lock-closed-outline"
                placeholder="Confirme a nova senha"
                secureTextEntry
                value={pw2}
                onChangeText={setPw2}
              />
              {error ? <Text style={[s.error, { color: colors.error }]}>{error}</Text> : null}
              <PrimaryButton testID="reset-submit" label="Redefinir senha" onPress={reset} loading={busy} style={s.btn} />
              <Pressable onPress={() => { setStep("email"); setError(""); setMsg(""); }} style={s.linkRow}>
                <Text style={[s.link, { color: colors.textSecondary }]}>Não recebeu? </Text>
                <Text style={[s.link, { color: colors.accent, fontFamily: fonts.bold }]}>Reenviar código</Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  backRow: { marginBottom: spacing.xl },
  brand: { marginBottom: spacing.xl },
  title: { fontFamily: fonts.bold, ...type.display, marginTop: spacing.xs },
  sub: { fontFamily: fonts.text, ...type.body, marginTop: spacing.md, lineHeight: 22 },
  msgBox: { borderRadius: 14, padding: spacing.lg, marginBottom: spacing.lg },
  msgText: { fontFamily: fonts.medium, ...type.bodySmall, lineHeight: 19 },
  form: { gap: spacing.lg },
  error: { fontFamily: fonts.text, ...type.bodySmall },
  btn: { marginTop: spacing.sm },
  linkRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.md },
  link: { fontFamily: fonts.text, ...type.bodySmall },
});
