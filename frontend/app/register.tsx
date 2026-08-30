import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { spacing, radius, fonts, type, shadow } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";

export default function Register() {
  const { colors, isDark } = useTheme();
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
      router.replace("/(tabs)");
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e.message || "Falha no cadastro");
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = [
    s.inputWrap,
    {
      backgroundColor: colors.inputBackground,
      ...(isDark ? {} : shadow.sm),
    },
  ];

  return (
    <View style={[s.root, { backgroundColor: colors.surface }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + spacing["2xl"], paddingBottom: insets.bottom + spacing["2xl"] }}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.content}>
          <Pressable testID="back-button" onPress={() => router.back()} style={[s.back, { backgroundColor: colors.surfaceTertiary }]}>
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </Pressable>

          <View style={s.brandArea}>
            <Text style={[s.kicker, { color: colors.brandPrimary }]}>Vamos começar</Text>
            <Text style={[s.title, { color: colors.onSurface }]}>CRIE SUA{"\n"}CONTA</Text>
            <Text style={[s.sub, { color: colors.onSurfaceSecondary }]}>Crie sua conta e comece a acompanhar seu desempenho.</Text>
          </View>

          <View style={s.form}>
            <View style={inputStyle}>
              <View style={[s.iconWrap, { backgroundColor: colors.brandPrimary + "18" }]}>
                <Ionicons name="person-outline" size={18} color={colors.brandPrimary} />
              </View>
              <TextInput
                testID="register-name-input"
                style={[s.input, { color: colors.onSurface }]}
                placeholder="Como devo te chamar"
                placeholderTextColor={colors.onSurfaceSecondary}
                value={name}
                onChangeText={setName}
              />
            </View>
            <View style={inputStyle}>
              <View style={[s.iconWrap, { backgroundColor: colors.brandPrimary + "18" }]}>
                <Ionicons name="mail-outline" size={18} color={colors.brandPrimary} />
              </View>
              <TextInput
                testID="register-email-input"
                style={[s.input, { color: colors.onSurface }]}
                placeholder="Email"
                placeholderTextColor={colors.onSurfaceSecondary}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>
            <View style={inputStyle}>
              <View style={[s.iconWrap, { backgroundColor: colors.brandPrimary + "18" }]}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.brandPrimary} />
              </View>
              <TextInput
                testID="register-password-input"
                style={[s.input, { color: colors.onSurface }]}
                placeholder="Senha (mín. 6)"
                placeholderTextColor={colors.onSurfaceSecondary}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            {error ? <Text style={[s.error, { color: colors.error }]} testID="register-error">{error}</Text> : null}

            <Pressable
              testID="register-submit-button"
              style={[s.btn, { backgroundColor: colors.brandPrimary, ...shadow.glow(colors.brandPrimary) }]}
              onPress={submit}
              disabled={busy}
            >
              {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={[s.btnText, { color: colors.onBrandPrimary }]}>Criar conta</Text>}
            </Pressable>

            <Pressable testID="go-login-button" onPress={() => router.replace("/login")} style={s.linkRow}>
              <Text style={[s.linkMuted, { color: colors.onSurfaceSecondary }]}>Já tem conta? </Text>
              <Text style={[s.link, { color: colors.brandPrimary }]}>Entrar</Text>
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
  back: {
    width: 44, height: 44, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.xl,
  },
  brandArea: { marginBottom: spacing["2xl"] },
  kicker: { fontFamily: fonts.bold, fontSize: type.sm, letterSpacing: 2, textTransform: "uppercase" },
  title: { fontFamily: fonts.display, fontSize: type["4xl"], lineHeight: type["4xl"] * 0.95, marginTop: spacing.xs },
  sub: { fontFamily: fonts.medium, fontSize: type.base, marginTop: spacing.md, lineHeight: 22 },
  form: { gap: spacing.lg },
  inputWrap: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    borderRadius: radius.lg, paddingHorizontal: spacing.lg, height: 56,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
  },
  input: { flex: 1, fontFamily: fonts.medium, fontSize: type.lg },
  error: { fontFamily: fonts.medium, fontSize: type.base },
  btn: {
    height: 56, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center", marginTop: spacing.sm,
  },
  btnText: { fontFamily: fonts.bold, fontSize: type.lg, letterSpacing: 1 },
  linkRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.md },
  linkMuted: { fontFamily: fonts.medium, fontSize: type.base },
  link: { fontFamily: fonts.bold, fontSize: type.base },
});
