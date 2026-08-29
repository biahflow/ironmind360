import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, spacing, radius, fonts, type } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";

export default function Register() {
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

  return (
    <View style={styles.root}>
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Pressable testID="back-button" onPress={() => router.back()} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
          </Pressable>

          <Text style={styles.kicker}>DIA 1 DE 40% RESTANTES</Text>
          <Text style={styles.title}>CRIE SUA{"\n"}CONTA</Text>
          <Text style={styles.sub}>Comprometa-se. Ninguém vai fazer isso por você.</Text>

          <View style={styles.form}>
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={18} color={colors.onSurfaceSecondary} />
              <TextInput
                testID="register-name-input"
                style={styles.input}
                placeholder="Como devo te chamar"
                placeholderTextColor={colors.onSurfaceSecondary}
                value={name}
                onChangeText={setName}
              />
            </View>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={colors.onSurfaceSecondary} />
              <TextInput
                testID="register-email-input"
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
                testID="register-password-input"
                style={styles.input}
                placeholder="Senha (mín. 6)"
                placeholderTextColor={colors.onSurfaceSecondary}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            {error ? <Text style={styles.error} testID="register-error">{error}</Text> : null}

            <Pressable testID="register-submit-button" style={styles.btn} onPress={submit} disabled={busy}>
              {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.btnText}>ACEITAR O DESAFIO</Text>}
            </Pressable>

            <Pressable testID="go-login-button" onPress={() => router.replace("/login")} style={styles.linkRow}>
              <Text style={styles.linkMuted}>Já tem conta? </Text>
              <Text style={styles.link}>Entrar</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { flex: 1, paddingHorizontal: spacing.xl },
  back: { width: 40, height: 40, justifyContent: "center", marginBottom: spacing.lg },
  kicker: { fontFamily: fonts.semibold, fontSize: type.sm, color: colors.brandSecondary, letterSpacing: 2 },
  title: { fontFamily: fonts.display, fontSize: type["4xl"], color: colors.onSurface, lineHeight: type["4xl"] * 0.95, marginTop: spacing.xs },
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
});
