import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { spacing, radius, fonts, type as tp, shadow } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/lib/api";
import MuscleMap from "@/src/components/MuscleMap";

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
  const { colors, isDark } = useTheme();
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
      <View style={[s.root, { backgroundColor: colors.surface }]}>
        <View style={[s.header, { paddingTop: insets.top + spacing.md, borderBottomColor: colors.divider }]}>
          <Pressable onPress={() => router.back()} style={[s.backBtn, { backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
          </Pressable>
        </View>
        <View style={s.center}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.surface }]}>
      <View style={[s.header, { paddingTop: insets.top + spacing.md, borderBottomColor: colors.divider }]}>
        <Pressable onPress={() => router.back()} style={[s.backBtn, { backgroundColor: colors.surfaceSecondary }]}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.onSurface }]} numberOfLines={1}>{exercise.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Muscle map illustration */}
        <View style={[s.illustrationArea, { backgroundColor: colors.surfaceSecondary, ...(isDark ? {} : shadow.sm) }]}>
          <MuscleMap
            primary={exercise.primary_muscles as any[]}
            secondary={exercise.secondary_muscles as any[]}
            size={100}
          />
        </View>

        {/* Badges */}
        <View style={s.badgeRow}>
          <View style={[s.badge, { backgroundColor: colors.surfaceTertiary }]}>
            <Text style={[s.badgeText, { color: colors.onSurfaceSecondary }]}>{PATTERN_LABEL[exercise.movement_pattern] || exercise.movement_pattern}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: colors.surfaceTertiary }]}>
            <Text style={[s.badgeText, { color: colors.onSurfaceSecondary }]}>{LEVEL_LABEL[exercise.min_level]}</Text>
          </View>
          {exercise.equipment.map((eq) => (
            <View key={eq} style={[s.badge, { backgroundColor: colors.surfaceTertiary }]}>
              <Text style={[s.badgeText, { color: colors.onSurfaceSecondary }]}>{eq}</Text>
            </View>
          ))}
        </View>

        {/* Muscles */}
        {(exercise.primary_muscles.length > 0 || exercise.secondary_muscles.length > 0) && (
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: colors.onSurfaceSecondary }]}>MÚSCULOS ATIVADOS</Text>
            {exercise.primary_muscles.length > 0 && (
              <View style={s.muscleRow}>
                <Text style={[s.muscleLabel, { color: colors.onSurfaceSecondary }]}>Primários</Text>
                <View style={s.muscleChips}>
                  {exercise.primary_muscles.map((m) => (
                    <View key={m} style={[s.musclePrimary, { backgroundColor: colors.brandTertiary }]}>
                      <Text style={[s.musclePrimaryText, { color: colors.brandSecondary }]}>{MUSCLE_LABEL[m] || m}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            {exercise.secondary_muscles.length > 0 && (
              <View style={[s.muscleRow, { marginTop: spacing.sm }]}>
                <Text style={[s.muscleLabel, { color: colors.onSurfaceSecondary }]}>Secundários</Text>
                <View style={s.muscleChips}>
                  {exercise.secondary_muscles.map((m) => (
                    <View key={m} style={[s.muscleSecondary, { backgroundColor: colors.surfaceTertiary }]}>
                      <Text style={[s.muscleSecondaryText, { color: colors.onSurfaceSecondary }]}>{MUSCLE_LABEL[m] || m}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Instructions */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.onSurfaceSecondary }]}>EXECUÇÃO</Text>
          <View style={[s.infoCard, { backgroundColor: colors.surfaceSecondary, ...(isDark ? {} : shadow.sm) }]}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} style={{ marginTop: 2 }} />
            <Text style={[s.infoText, { color: colors.onSurfaceTertiary }]}>{exercise.instructions}</Text>
          </View>
        </View>

        {/* Common errors */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.onSurfaceSecondary }]}>ERROS COMUNS</Text>
          <View style={[s.infoCard, { backgroundColor: colors.surfaceSecondary, ...(isDark ? {} : shadow.sm) }]}>
            <Ionicons name="alert-circle" size={20} color={colors.warning} style={{ marginTop: 2 }} />
            <Text style={[s.infoText, { color: colors.onSurfaceTertiary }]}>{exercise.common_errors}</Text>
          </View>
        </View>

        {/* Regression / Progression */}
        {(exercise.regression_id || exercise.progression_id) && (
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: colors.onSurfaceSecondary }]}>VARIAÇÕES</Text>
            {exercise.regression_id && (
              <Pressable
                style={[s.variationBtn, { backgroundColor: colors.surfaceSecondary, ...(isDark ? {} : shadow.sm) }]}
                onPress={() => router.push({ pathname: "/exercise-detail", params: { id: exercise.regression_id! } })}
              >
                <Ionicons name="arrow-down-circle" size={20} color={colors.success} />
                <Text style={[s.variationText, { color: colors.onSurface }]}>Ver regressão (mais fácil)</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceSecondary} />
              </Pressable>
            )}
            {exercise.progression_id && (
              <Pressable
                style={[s.variationBtn, { backgroundColor: colors.surfaceSecondary, ...(isDark ? {} : shadow.sm) }]}
                onPress={() => router.push({ pathname: "/exercise-detail", params: { id: exercise.progression_id! } })}
              >
                <Ionicons name="arrow-up-circle" size={20} color={colors.brandPrimary} />
                <Text style={[s.variationText, { color: colors.onSurface }]}>Ver progressão (mais difícil)</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceSecondary} />
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: {
    flex: 1, fontFamily: fonts.display, fontSize: tp["2xl"],
    letterSpacing: 1, textAlign: "center",
  },

  illustrationArea: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: spacing.lg, marginBottom: spacing.xl, paddingVertical: spacing.xl,
    borderRadius: radius.xl, minHeight: 200,
  },

  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  badge: {
    paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill,
  },
  badgeText: { fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.5 },

  section: { marginBottom: spacing["2xl"] },
  sectionTitle: {
    fontFamily: fonts.bold, fontSize: tp.sm,
    letterSpacing: 2, marginBottom: spacing.md,
  },

  muscleRow: {},
  muscleLabel: { fontFamily: fonts.semibold, fontSize: tp.sm, marginBottom: spacing.xs },
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
    borderRadius: radius.lg, padding: spacing.xl,
  },
  infoText: {
    flex: 1, fontFamily: fonts.text, fontSize: tp.base,
    lineHeight: 22,
  },

  variationBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.md,
  },
  variationText: { flex: 1, fontFamily: fonts.medium, fontSize: tp.base },
});
