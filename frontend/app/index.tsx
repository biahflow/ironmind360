import { useEffect } from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { colors, fonts } from "@/src/theme";

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) router.replace("/(tabs)");
    else router.replace("/login");
  }, [user, loading, router]);

  return (
    <View style={styles.container} testID="splash-screen">
      <Text style={styles.logo}>IRONMIND</Text>
      <Text style={styles.tag}>360 · STAY HARD</Text>
      <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 24 }} />
      <Text style={styles.init}>INICIANDO PROTOCOLO...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  logo: { fontFamily: fonts.display, fontSize: 64, color: colors.onSurface, letterSpacing: 2 },
  tag: { fontFamily: fonts.medium, fontSize: 14, color: colors.brandPrimary, letterSpacing: 4, marginTop: -8 },
  init: { fontFamily: fonts.mono, fontSize: 11, color: colors.onSurfaceSecondary, marginTop: 12, letterSpacing: 1 },
});
