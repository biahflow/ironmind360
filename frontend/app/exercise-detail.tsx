import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { spacing, radius, fonts, type } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/lib/api";
import MuscleMap from "@/src/components/MuscleMap";
import { Screen, ScreenHeader, Card, Overline } from "@/src/components/ui";

const MUSCLE_LABEL: Record<string, string> = {
  quadriceps: "Quadríceps", hamstrings: "Isquiotibiais", glutes: "Glúteos",
  calves: "Panturrilhas", chest: "Peitoral", upper_back: "Dorsal superior",
  lats: "Latíssimo", shoulders: "Ombros", deltoids: "Deltoides",
  biceps: "Bíceps", triceps: "Tríceps", forearms: "Antebraços",
  core: "Core", obliques: "Oblíquos", hip_flexors: "Flexores do quadril",
  adductors: "Adutores", abductors: "Abdutores", rotator_cuff: "Manguito rotador",
  scapular: "Escapular", erectors: "Eretores",
};

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Iniciante", intermediate: "Intermediário", advanced: "Avançado",
};

const PATTERN_LABEL: Record<string, string> = {
  squat: "Agachamento", hinge: "Hinge", lunge: "Avanço",
  push_horizontal: "Empurrada horizontal", push_vertical: "Empurrada vertical",
  pull_horizontal: "Puxada horizontal", pull_vertical: "Puxada vertical",
  anti_rotation: "Antirrotação", anti_extension: "Anti-extensão",
  anti_lateral_flexion: "Anti-flexão lateral",
  carry: "Carry", calf: "Panturrilha", hip_stability: "Estabilidade de quadril",
  mobility: "Mobilidade", warmup: "Aquecimento",
};

type Exercise = {
  id: string;
  name: string;
  movement_pattern: string;
  equipment: string[];
  environment: string;
  min_level: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  image_url?: string;
  video_url?: string;
  instructions: string;
  common_errors: string;
  regression_id?: string;
  progression_id?: string;
  alternatives: string[];
};

export default function ExerciseDetail() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const d = await api.get(`/exercises/${id}`);
      setExercise(d);
    } catch {}
    setLoading(false);
  }, [id]);

  React.useEffect(() => { load(); }, [load]);

  if (loading || !exercise) {
    return (
      <Screen>
        <ScreenHeader title="" onBack={() => router.back()} />
        <View style={s.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title={exercise.name} onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={{ padding: spacing["2xl"], paddingTop: spacing.md, paddingBottom: insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Muscle map illustration */}
        <View style={[s.illustrationArea, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MuscleMap
            primary={exercise.primary_muscles as any[]}
            secondary={exercise.secondary_muscles as any[]}
            size={100}
          />
        </View>

        {/* Badges */}
        <View style={s.badgeRow}>
          <View style={[s.badge, { backgroundColor: colors.elevated }]}>
            <Text style={[s.badgeText, { color: colors.textSecondary }]}>{PATTERN_LABEL[exercise.movement_pattern] || exercise.movement_pattern}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: colors.elevated }]}>
            <Text style={[s.badgeText, { color: colors.textSecondary }]}>{LEVEL_LABEL[exercise.min_level]}</Text>
          </View>
          {exercise.equipment.map((eq) => (
            <View key={eq} style={[s.badge, { backgroundColor: colors.elevated }]}>
              <Text style={[s.badgeText, { color: colors.textSecondary }]}>{eq}</Text>
            </View>
          ))}
        </View>

        {/* Muscles */}
        {(exercise.primary_muscles.length > 0 || exercise.secondary_muscles.length > 0) && (
          <View style={s.section}>
            <Overline style={s.sectionTitle}>MÚSCULOS ATIVADOS</Overline>
            {exercise.primary_muscles.length > 0 && (
              <View style={s.muscleRow}>
                <Text style={[s.muscleLabel, { color: colors.textSecondary }]}>Primários</Text>
                <View style={s.muscleChips}>
                  {exercise.primary_muscles.map((m) => (
                    <View key={m} style={[s.musclePrimary, { backgroundColor: colors.accentMuted }]}>
                      <Text style={[s.musclePrimaryText, { color: colors.accent }]}>{MUSCLE_LABEL[m] || m}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            {exercise.secondary_muscles.length > 0 && (
              <View style={[s.muscleRow, { marginTop: spacing.sm }]}>
                <Text style={[s.muscleLabel, { color: colors.textSecondary }]}>Secundários</Text>
                <View style={s.muscleChips}>
                  {exercise.secondary_muscles.map((m) => (
                    <View key={m} style={[s.muscleSecondary, { backgroundColor: colors.elevated }]}>
                      <Text style={[s.muscleSecondaryText, { color: colors.textSecondary }]}>{MUSCLE_LABEL[m] || m}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Instructions */}
        <View style={s.section}>
          <Overline style={s.sectionTitle}>EXECUÇÃO</Overline>
          <Card style={s.infoCard}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} style={{ marginTop: 2 }} />
            <Text style={[s.infoText, { color: colors.textSecondary }]}>{exercise.instructions}</Text>
          </Card>
        </View>

        {/* Common errors */}
        <View style={s.section}>
          <Overline style={s.sectionTitle}>ERROS COMUNS</Overline>
          <Card style={s.infoCard}>
            <Ionicons name="alert-circle" size={20} color={colors.warning} style={{ marginTop: 2 }} />
            <Text style={[s.infoText, { color: colors.textSecondary }]}>{exercise.common_errors}</Text>
          </Card>
        </View>

        {/* Regression / Progression */}
        {(exercise.regression_id || exercise.progression_id) && (
          <View style={s.section}>
            <Overline style={s.sectionTitle}>VARIAÇÕES</Overline>
            {exercise.regression_id && (
              <Card
                onPress={() => router.push({ pathname: "/exercise-detail", params: { id: exercise.regression_id! } })}
                style={s.variationBtn}
              >
                <Ionicons name="arrow-down-circle" size={20} color={colors.success} />
                <Text style={[s.variationText, { color: colors.text }]}>Ver regressão (mais fácil)</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </Card>
            )}
            {exercise.progression_id && (
              <Card
                onPress={() => router.push({ pathname: "/exercise-detail", params: { id: exercise.progression_id! } })}
                style={s.variationBtn}
              >
                <Ionicons name="arrow-up-circle" size={20} color={colors.accent} />
                <Text style={[s.variationText, { color: colors.text }]}>Ver progressão (mais difícil)</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </Card>
            )}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  illustrationArea: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: spacing.lg, marginBottom: spacing.xl, paddingVertical: spacing.xl,
    borderRadius: radius.xl, borderWidth: 1, minHeight: 200,
  },

  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  badge: {
    paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill,
  },
  badgeText: { fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.5 },

  section: { marginBottom: spacing["2xl"] },
  sectionTitle: { marginBottom: spacing.md },

  muscleRow: {},
  muscleLabel: { fontFamily: fonts.semibold, ...type.bodySmall, marginBottom: spacing.xs },
  muscleChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  musclePrimary: {
    paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill,
  },
  musclePrimaryText: { fontFamily: fonts.semibold, fontSize: 11 },
  muscleSecondary: {
    paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill,
  },
  muscleSecondaryText: { fontFamily: fonts.medium, fontSize: 11 },

  infoCard: {
    flexDirection: "row", gap: spacing.md,
  },
  infoText: {
    flex: 1, fontFamily: fonts.text, ...type.body,
  },

  variationBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    marginBottom: spacing.md,
  },
  variationText: { flex: 1, fontFamily: fonts.medium, ...type.body },
});
