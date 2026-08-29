import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { colors, spacing, radius, fonts, type as tp } from "@/src/theme";
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
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{exercise.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Muscle map illustration */}
        <View style={styles.illustrationArea}>
          <MuscleMap
            primary={exercise.primary_muscles as any[]}
            secondary={exercise.secondary_muscles as any[]}
            size={100}
          />
        </View>

        {/* Badges */}
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{PATTERN_LABEL[exercise.movement_pattern] || exercise.movement_pattern}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{LEVEL_LABEL[exercise.min_level]}</Text>
          </View>
          {exercise.equipment.map((eq) => (
            <View key={eq} style={styles.badge}>
              <Text style={styles.badgeText}>{eq}</Text>
            </View>
          ))}
        </View>

        {/* Muscles */}
        {(exercise.primary_muscles.length > 0 || exercise.secondary_muscles.length > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>MÚSCULOS ATIVADOS</Text>
            {exercise.primary_muscles.length > 0 && (
              <View style={styles.muscleRow}>
                <Text style={styles.muscleLabel}>Primários</Text>
                <View style={styles.muscleChips}>
                  {exercise.primary_muscles.map((m) => (
                    <View key={m} style={styles.musclePrimary}>
                      <Text style={styles.musclePrimaryText}>{MUSCLE_LABEL[m] || m}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            {exercise.secondary_muscles.length > 0 && (
              <View style={[styles.muscleRow, { marginTop: spacing.sm }]}>
                <Text style={styles.muscleLabel}>Secundários</Text>
                <View style={styles.muscleChips}>
                  {exercise.secondary_muscles.map((m) => (
                    <View key={m} style={styles.muscleSecondary}>
                      <Text style={styles.muscleSecondaryText}>{MUSCLE_LABEL[m] || m}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>EXECUÇÃO</Text>
          <View style={styles.infoCard}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} style={{ marginTop: 2 }} />
            <Text style={styles.infoText}>{exercise.instructions}</Text>
          </View>
        </View>

        {/* Common errors */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ERROS COMUNS</Text>
          <View style={styles.infoCard}>
            <Ionicons name="alert-circle" size={20} color={colors.warning} style={{ marginTop: 2 }} />
            <Text style={styles.infoText}>{exercise.common_errors}</Text>
          </View>
        </View>

        {/* Regression / Progression */}
        {(exercise.regression_id || exercise.progression_id) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>VARIAÇÕES</Text>
            {exercise.regression_id && (
              <Pressable
                style={styles.variationBtn}
                onPress={() => router.push({ pathname: "/exercise-detail", params: { id: exercise.regression_id! } })}
              >
                <Ionicons name="arrow-down-circle" size={20} color={colors.success} />
                <Text style={styles.variationText}>Ver regressão (mais fácil)</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceSecondary} />
              </Pressable>
            )}
            {exercise.progression_id && (
              <Pressable
                style={styles.variationBtn}
                onPress={() => router.push({ pathname: "/exercise-detail", params: { id: exercise.progression_id! } })}
              >
                <Ionicons name="arrow-up-circle" size={20} color={colors.brandPrimary} />
                <Text style={styles.variationText}>Ver progressão (mais difícil)</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceSecondary} />
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  headerTitle: {
    flex: 1, fontFamily: fonts.display, fontSize: tp["2xl"],
    color: colors.onSurface, letterSpacing: 1, textAlign: "center",
  },

  illustrationArea: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: spacing.lg, marginBottom: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, minHeight: 200,
  },

  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  badge: {
    paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm,
    backgroundColor: colors.surfaceTertiary,
  },
  badgeText: { fontFamily: fonts.medium, fontSize: 11, color: colors.onSurfaceSecondary, letterSpacing: 0.5 },

  section: { marginBottom: spacing.xl },
  sectionTitle: {
    fontFamily: fonts.bold, fontSize: tp.sm, color: colors.onSurfaceSecondary,
    letterSpacing: 2, marginBottom: spacing.md,
  },

  muscleRow: {},
  muscleLabel: { fontFamily: fonts.semibold, fontSize: tp.sm, color: colors.onSurfaceSecondary, marginBottom: spacing.xs },
  muscleChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  musclePrimary: {
    paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm,
    backgroundColor: colors.brandTertiary,
  },
  musclePrimaryText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.brandSecondary },
  muscleSecondary: {
    paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm,
    backgroundColor: colors.surfaceTertiary,
  },
  muscleSecondaryText: { fontFamily: fonts.medium, fontSize: 11, color: colors.onSurfaceSecondary },

  infoCard: {
    flexDirection: "row", gap: spacing.md, backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border,
  },
  infoText: {
    flex: 1, fontFamily: fonts.text, fontSize: tp.base, color: colors.onSurfaceTertiary,
    lineHeight: 22,
  },

  variationBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  variationText: { flex: 1, fontFamily: fonts.medium, fontSize: tp.base, color: colors.onSurface },
});
