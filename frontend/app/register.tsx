import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { spacing, radius, fonts, type } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { IconButton, Overline, PrimaryButton } from "@/src/components/ui";

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

  const inputStyle = [
    s.inputWrap,
    { backgroundColor: colors.inputBackground, borderColor: colors.border },
  ];

  return (
    <View style={[s.root, { backgroundColor: colors.bg }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + spacing["2xl"], paddingBottom: insets.bottom + spacing["2xl"] }}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.content}>
          <View style={s.backRow}>
            <IconButton testID="back-button" icon="chevron-back" onPress={() => router.back()} size={20} color={colors.text} />
          </View>

          <View style={s.brandArea}>
            <Overline color={colors.accent}>Vamos começar</Overline>
            <Text style={[s.title, { color: colors.text }]}>CRIE SUA{"\n"}CONTA</Text>
            <Text style={[s.sub, { color: colors.textSecondary }]}>Crie sua conta e comece a acompanhar seu desempenho.</Text>
          </View>

          <View style={s.form}>
            <View style={inputStyle}>
              <View style={[s.iconWrap, { backgroundColor: colors.accentMuted }]}>
                <Ionicons name="person-outline" size={18} color={colors.accent} />
              </View>
              <TextInput
                testID="register-name-input"
                style={[s.input, { color: colors.text }]}
                placeholder="Como devo te chamar"
                placeholderTextColor={colors.textSecondary}
                value={name}
                onChangeText={setName}
              />
            </View>
            <View style={inputStyle}>
              <View style={[s.iconWrap, { backgroundColor: colors.accentMuted }]}>
                <Ionicons name="mail-outline" size={18} color={colors.accent} />
              </View>
              <TextInput
                testID="register-email-input"
                style={[s.input, { color: colors.text }]}
                placeholder="Email"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>
            <View style={inputStyle}>
              <View style={[s.iconWrap, { backgroundColor: colors.accentMuted }]}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.accent} />
              </View>
              <TextInput
                testID="register-password-input"
                style={[s.input, { color: colors.text }]}
                placeholder="Senha (mín. 6)"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

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
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, paddingHorizontal: spacing.xl },
  backRow: { marginBottom: spacing.xl },
  brandArea: { marginBottom: spacing["2xl"] },
  title: { fontFamily: fonts.bold, ...type.display, marginTop: spacing.xs },
  sub: { fontFamily: fonts.text, ...type.body, marginTop: spacing.md, lineHeight: 22 },
  form: { gap: spacing.lg },
  inputWrap: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    borderRadius: radius.lg, paddingHorizontal: spacing.lg, height: 56, borderWidth: 1,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
  },
  input: { flex: 1, fontFamily: fonts.text, ...type.body },
  error: { fontFamily: fonts.text, ...type.bodySmall },
  btn: { marginTop: spacing.sm },
  linkRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.md },
  linkMuted: { fontFamily: fonts.text, ...type.bodySmall },
  link: { fontFamily: fonts.bold, ...type.bodySmall },
});
