import { useEffect } from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { spacing, fonts, type, shadow } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";

export default function Index() {
  const { colors, isDark } = useTheme();
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) router.replace("/(tabs)");
    else router.replace("/login");
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
