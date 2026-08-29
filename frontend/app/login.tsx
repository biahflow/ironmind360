import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Dimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, spacing, radius, fonts, type } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";

const HERO = "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODh8MHwxfHNlYXJjaHwxfHxkYXJrJTIwZ3JpdHR5JTIwcnVubmluZyUyMG1hcmF0aG9uJTIwdG91Z2glMjBmaXRuZXNzfGVufDB8fHx8MTc4ODAyNzc2N3ww&ixlib=rb-4.1.0&q=85";
const { height } = Dimensions.get("window");

export default function Login() {
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
    <View style={styles.root}>
      <Image source={{ uri: HERO }} style={styles.hero} contentFit="cover" />
      <LinearGradient
        colors={["rgba(7,7,9,0.2)", "rgba(7,7,9,0.75)", "rgba(7,7,9,0.98)"]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + spacing.xl }}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.content, { paddingTop: height * 0.28 }]}>
          <Text style={styles.kicker}>NÃO NEGOCIE COM A FRAQUEZA</Text>
          <Text style={styles.logo}>IRONMIND 360</Text>
          <Text style={styles.sub}>Sua transformação começa quando você para de dar desculpas.</Text>

          <View style={styles.form}>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={colors.onSurfaceSecondary} />
              <TextInput
                testID="login-email-input"
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.onSurfaceSecondary}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.onSurfaceSecondary} />
              <TextInput
                testID="login-password-input"
                style={styles.input}
                placeholder="Senha"
                placeholderTextColor={colors.onSurfaceSecondary}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            {error ? <Text style={styles.error} testID="login-error">{error}</Text> : null}

            <Pressable testID="login-submit-button" style={styles.btn} onPress={submit} disabled={busy}>
              {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.btnText}>ENTRAR NO PROTOCOLO</Text>}
            </Pressable>

            <Pressable testID="go-register-button" onPress={() => router.push("/register")} style={styles.linkRow}>
              <Text style={styles.linkMuted}>Ainda não começou? </Text>
              <Text style={styles.link}>Criar conta</Text>
            </Pressable>

          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  hero: { ...StyleSheet.absoluteFillObject, height: height * 0.6 },
  content: { flex: 1, paddingHorizontal: spacing.xl },
  kicker: { fontFamily: fonts.semibold, fontSize: type.sm, color: colors.brandSecondary, letterSpacing: 2 },
  logo: { fontFamily: fonts.display, fontSize: type["5xl"], color: colors.onSurface, letterSpacing: 1, lineHeight: type["5xl"] },
  sub: { fontFamily: fonts.text, fontSize: type.base, color: colors.onSurfaceSecondary, marginTop: spacing.sm, marginBottom: spacing.xl },
  form: { gap: spacing.md },
  inputWrap: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 54,
  },
  input: { flex: 1, color: colors.onSurface, fontFamily: fonts.text, fontSize: type.lg },
  error: { color: colors.brandSecondary, fontFamily: fonts.medium, fontSize: type.base },
  btn: {
    backgroundColor: colors.brandPrimary, height: 56, borderRadius: radius.md,
    alignItems: "center", justifyContent: "center", marginTop: spacing.sm,
  },
  btnText: { color: colors.onBrandPrimary, fontFamily: fonts.bold, fontSize: type.lg, letterSpacing: 1 },
  linkRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.md },
  linkMuted: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: type.base },
  link: { color: colors.brandSecondary, fontFamily: fonts.bold, fontSize: type.base },
  demoBox: { marginTop: spacing.lg, alignItems: "center" },
  demoText: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm },
});
