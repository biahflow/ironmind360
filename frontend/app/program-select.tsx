import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { spacing, fonts, type } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/lib/api";
import { Screen, ScreenHeader, Card, Chip, PrimaryButton, EmptyState } from "@/src/components/ui";

type Tone = "accent" | "neutral" | "success" | "warning" | "error" | "info";

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Iniciante",
  intermediate: "Intermediário",
  advanced: "Avançado",
};
const LEVEL_TONE: Record<string, Tone> = {
  beginner: "success",
  intermediate: "warning",
  advanced: "error",
};
const ENV_LABEL: Record<string, string> = { home: "Casa", gym: "Academia" };

type Program = {
  id: string;
  name: string;
  level: string;
  environment: string;
  weeks: number;
  sessions_per_week: number;
  description: string;
};

export default function ProgramSelect() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.get("/programs");
      setPrograms(d.programs || []);
    } catch {}
    setLoading(false);
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const startProgram = async (p: Program) => {
    setStarting(p.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      await api.post("/training/start", { program_id: p.id, session_number: 1 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setStarting(null);
    }
  };

  const renderItem = ({ item }: { item: Program }) => {
    const active = starting === item.id;
    return (
      <Card>
        <View style={s.cardHeader}>
          <Chip label={LEVEL_LABEL[item.level] || item.level} tone={LEVEL_TONE[item.level] || "accent"} />
          <Chip
            label={ENV_LABEL[item.environment]}
            tone="neutral"
            icon={item.environment === "home" ? "home" : "barbell"}
          />
        </View>

        <Text style={[s.cardTitle, { color: colors.text }]}>{item.name}</Text>
        <Text style={[s.cardDesc, { color: colors.textSecondary }]} numberOfLines={3}>{item.description}</Text>

        <View style={s.cardMeta}>
          <View style={s.metaItem}>
            <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
            <Text style={[s.metaText, { color: colors.textSecondary }]}>{item.weeks} semanas</Text>
          </View>
          <View style={s.metaItem}>
            <Ionicons name="repeat" size={14} color={colors.textSecondary} />
            <Text style={[s.metaText, { color: colors.textSecondary }]}>{item.sessions_per_week}x/semana</Text>
          </View>
          <View style={s.metaItem}>
            <Ionicons name="flash" size={14} color={colors.textSecondary} />
            <Text style={[s.metaText, { color: colors.textSecondary }]}>{item.weeks * item.sessions_per_week} sessões</Text>
          </View>
        </View>

        <PrimaryButton
          label="Iniciar programa"
          onPress={() => startProgram(item)}
          loading={active}
          disabled={!!starting}
          style={s.startBtn}
        />
      </Card>
    );
  };

  return (
    <Screen>
      <ScreenHeader title="Programas" onBack={() => router.back()} />

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={programs}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.xl,
          }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          ListEmptyComponent={
            <EmptyState
              icon="albums-outline"
              title="Nenhum programa disponível"
              text="Novos programas de preparação física aparecerão aqui."
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  cardHeader: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },

  cardTitle: { fontFamily: fonts.bold, ...type.h2 },
  cardDesc: {
    fontFamily: fonts.text, ...type.bodySmall,
    marginTop: spacing.xs,
  },

  cardMeta: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.md },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontFamily: fonts.text, ...type.caption },

  startBtn: { marginTop: spacing.xl },
});
