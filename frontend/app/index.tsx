import { useEffect, useState } from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/lib/api";
import { spacing, fonts, type, shadow } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";

export default function Index() {
  const { colors, isDark } = useTheme();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    setChecking(true);
    api.get("/profile").then((profile) => {
      if (profile.onboarding_completed) {
        router.replace("/(tabs)");
      } else {
        router.replace("/onboarding");
      }
    }).catch(() => {
      router.replace("/(tabs)");
    }).finally(() => setChecking(false));
  }, [user, loading, router]);

  return (
    <View style={[s.container, { backgroundColor: colors.surface }]} testID="splash-screen">
      <View style={[s.logoWrap, { ...(isDark ? {} : shadow.glow(colors.brandPrimary)) }]}>
        <Text style={[s.logo, { color: colors.onSurface }]}>IRONMIND</Text>
        <Text style={[s.tag, { color: colors.brandPrimary }]}>360</Text>
      </View>
      <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing["2xl"] }} />
      <Text style={[s.init, { color: colors.onSurfaceSecondary }]}>Carregando...</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  logoWrap: { alignItems: "center" },
  logo: { fontFamily: fonts.display, fontSize: 72, letterSpacing: 3 },
  tag: { fontFamily: fonts.bold, fontSize: type.xl, letterSpacing: 8, marginTop: -4 },
  init: { fontFamily: fonts.medium, fontSize: type.sm, marginTop: spacing.lg, letterSpacing: 1 },
});
