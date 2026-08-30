import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Dimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { spacing, radius, fonts, type, shadow } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";

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
    ? ["rgba(10,10,10,0.1)", "rgba(10,10,10,0.65)", "rgba(10,10,10,0.98)"] as const
    : ["rgba(255,255,255,0.1)", "rgba(255,255,255,0.65)", "rgba(255,255,255,0.98)"] as const;

  const inputStyle = [
    s.inputWrap,
    {
      backgroundColor: colors.inputBackground,
      ...(isDark ? {} : shadow.sm),
    },
  ];

  return (
    <View style={[s.root, { backgroundColor: colors.surface }]}>
      <Image source={{ uri: HERO }} style={s.hero} contentFit="cover" />
      <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} />
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + spacing["2xl"] }}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.content, { paddingTop: height * 0.3 }]}>
          <Text style={[s.kicker, { color: colors.brandPrimary }]}>Sua jornada começa aqui</Text>
          <Text style={[s.logo, { color: colors.onSurface }]}>IRONMIND 360</Text>
          <Text style={[s.sub, { color: colors.onSurfaceSecondary }]}>Acompanhe treino, nutrição e saúde em um só lugar.</Text>

          <View style={s.form}>
            <View style={inputStyle}>
              <View style={[s.iconWrap, { backgroundColor: colors.brandPrimary + "18" }]}>
                <Ionicons name="mail-outline" size={18} color={colors.brandPrimary} />
              </View>
              <TextInput
                testID="login-email-input"
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
                testID="login-password-input"
                style={[s.input, { color: colors.onSurface }]}
                placeholder="Senha"
                placeholderTextColor={colors.onSurfaceSecondary}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            {error ? <Text style={[s.error, { color: colors.error }]} testID="login-error">{error}</Text> : null}

            <Pressable
              testID="login-submit-button"
              style={[s.btn, { backgroundColor: colors.brandPrimary, ...shadow.glow(colors.brandPrimary) }]}
              onPress={submit}
              disabled={busy}
            >
              {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={[s.btnText, { color: colors.onBrandPrimary }]}>Entrar</Text>}
            </Pressable>

            <Pressable testID="go-register-button" onPress={() => router.push("/register")} style={s.linkRow}>
              <Text style={[s.linkMuted, { color: colors.onSurfaceSecondary }]}>Ainda não tem conta? </Text>
              <Text style={[s.link, { color: colors.brandPrimary }]}>Criar conta</Text>
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
  kicker: { fontFamily: fonts.bold, fontSize: type.sm, letterSpacing: 2, textTransform: "uppercase" },
  logo: { fontFamily: fonts.display, fontSize: type["5xl"], letterSpacing: 2, lineHeight: type["5xl"] },
  sub: { fontFamily: fonts.medium, fontSize: type.base, marginTop: spacing.sm, marginBottom: spacing["2xl"], lineHeight: 22 },
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
