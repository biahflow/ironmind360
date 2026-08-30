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
import { Screen, ScreenHeader, Card, Overline, Chip } from "@/src/components/ui";

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

const EQUIPMENT_LABEL: Record<string, string> = {
  bodyweight: "Peso corporal", dumbbell: "Halteres", barbell: "Barra",
  kettlebell: "Kettlebell", band: "Faixa elástica", miniband: "Mini band",
  bench: "Banco", pull_up_bar: "Barra fixa", cable: "Cabo", machine: "Máquina",
  foam_roller: "Rolo de espuma", swiss_ball: "Bola suíça", trx: "TRX",
  box: "Caixa / step", wall: "Parede",
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

// Placeholder visual por padrão de movimento até termos mídia real por
// exercício (ver referência Hevy). Cada padrão ganha um ícone consistente.
type IconName = keyof typeof Ionicons.glyphMap;
const PATTERN_ICON: Record<string, IconName> = {
  squat: "barbell", hinge: "body", lunge: "walk",
  push_horizontal: "arrow-forward-circle", push_vertical: "arrow-up-circle",
  pull_horizontal: "arrow-back-circle", pull_vertical: "arrow-down-circle",
  anti_rotation: "sync-circle", anti_extension: "shield",
  anti_lateral_flexion: "shield-half",
  carry: "briefcase", calf: "footsteps", hip_stability: "accessibility",
  mobility: "refresh-circle", warmup: "flame",
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
      // Alguns exercícios (ex.: variações de peso corporal) vêm sem os arrays
      // de músculos/equipamento; normalizamos para não quebrar a renderização.
      setExercise({
        ...d,
        primary_muscles: d.primary_muscles ?? [],
        secondary_muscles: d.secondary_muscles ?? [],
        equipment: d.equipment ?? [],
        alternatives: d.alternatives ?? [],
      });
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
        contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.md, paddingBottom: insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Placeholder visual por padrão de movimento + mapa muscular */}
        <View style={[s.illustrationArea, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={s.patternCol}>
            <View style={[s.patternBadge, { backgroundColor: colors.accentMuted }]}>
              <Ionicons
                name={PATTERN_ICON[exercise.movement_pattern] || "fitness"}
                size={44}
                color={colors.accent}
              />
            </View>
            <Text style={[s.patternCaption, { color: colors.textSecondary }]}>
              {PATTERN_LABEL[exercise.movement_pattern] || exercise.movement_pattern}
            </Text>
          </View>
          {(exercise.primary_muscles.length > 0 || exercise.secondary_muscles.length > 0) && (
            <View style={s.mapWrap}>
              <MuscleMap
                primary={exercise.primary_muscles as any[]}
                secondary={exercise.secondary_muscles as any[]}
                size={92}
              />
            </View>
          )}
        </View>

        {/* Badges */}
        <View style={s.badgeRow}>
          <Chip label={PATTERN_LABEL[exercise.movement_pattern] || exercise.movement_pattern} tone="neutral" />
          <Chip label={LEVEL_LABEL[exercise.min_level]} tone="neutral" />
          {exercise.equipment.map((eq) => (
            <Chip key={eq} label={EQUIPMENT_LABEL[eq] || eq} tone="neutral" />
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
                    <Chip key={m} label={MUSCLE_LABEL[m] || m} tone="accent" />
                  ))}
                </View>
              </View>
            )}
            {exercise.secondary_muscles.length > 0 && (
              <View style={[s.muscleRow, { marginTop: spacing.sm }]}>
                <Text style={[s.muscleLabel, { color: colors.textSecondary }]}>Secundários</Text>
                <View style={s.muscleChips}>
                  {exercise.secondary_muscles.map((m) => (
                    <Chip key={m} label={MUSCLE_LABEL[m] || m} tone="neutral" />
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
    borderRadius: radius.cardLarge, borderWidth: 1, minHeight: 200,
  },
  patternCol: { alignItems: "center", gap: spacing.sm },
  patternBadge: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: "center", justifyContent: "center",
  },
  patternCaption: {
    fontFamily: fonts.semibold, ...type.caption,
    textTransform: "uppercase", letterSpacing: 1,
  },
  mapWrap: { alignItems: "center", justifyContent: "center" },

  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },

  section: { marginBottom: spacing["2xl"] },
  sectionTitle: { marginBottom: spacing.md },

  muscleRow: {},
  muscleLabel: { fontFamily: fonts.semibold, ...type.bodySmall, marginBottom: spacing.xs },
  muscleChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },

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
