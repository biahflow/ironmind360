import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Dimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { spacing, radius, fonts, type } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { Overline, PrimaryButton } from "@/src/components/ui";

const HERO = "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODh8MHwxfHNlYXJjaHwxfHxkYXJrJTIwZ3JpdHR5JTIwcnVubmluZyUyMG1hcmF0aG9uJTIwdG91Z2glMjBmaXRuZXNzfGVufDB8fHx8MTc4ODAyNzc2N3ww&ixlib=rb-4.1.0&q=85";
const { height } = Dimensions.get("window");

export default function Login() {
  const { colors, isDark } = useTheme();
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

  const gradientColors = isDark
    ? ["rgba(16,16,17,0.1)", "rgba(16,16,17,0.65)", "rgba(16,16,17,0.98)"] as const
    : ["rgba(247,247,244,0.1)", "rgba(247,247,244,0.65)", "rgba(247,247,244,0.98)"] as const;

  const inputStyle = [
    s.inputWrap,
    { backgroundColor: colors.inputBackground, borderColor: colors.border },
  ];

  return (
    <View style={[s.root, { backgroundColor: colors.bg }]}>
      <Image source={{ uri: HERO }} style={s.hero} contentFit="cover" />
      <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} />
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + spacing["2xl"] }}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.content, { paddingTop: height * 0.3 }]}>
          <Overline color={colors.accent}>Sua jornada começa aqui</Overline>
          <Text style={[s.logo, { color: colors.text }]}>IRONMIND 360</Text>
          <Text style={[s.sub, { color: colors.textSecondary }]}>Acompanhe treino, nutrição e saúde em um só lugar.</Text>

          <View style={s.form}>
            <View style={inputStyle}>
              <View style={[s.iconWrap, { backgroundColor: colors.accentMuted }]}>
                <Ionicons name="mail-outline" size={18} color={colors.accent} />
              </View>
              <TextInput
                testID="login-email-input"
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
                testID="login-password-input"
                style={[s.input, { color: colors.text }]}
                placeholder="Senha"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

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
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  hero: { ...StyleSheet.absoluteFillObject, height: height * 0.6 },
  content: { flex: 1, paddingHorizontal: spacing.xl },
  logo: { fontFamily: fonts.bold, ...type.display, marginTop: spacing.xs },
  sub: { fontFamily: fonts.text, ...type.body, marginTop: spacing.sm, marginBottom: spacing["2xl"], lineHeight: 22 },
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
