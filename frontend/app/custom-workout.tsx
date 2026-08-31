import React, { useCallback, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { spacing, radius, fonts, type } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/lib/api";
import {
  Screen, ScreenHeader, Input, SectionHeader, PrimaryButton, EmptyState, LoadingState, Chip,
} from "@/src/components/ui";

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Iniciante", intermediate: "Intermediário", advanced: "Avançado",
};

type CatalogExercise = {
  id: string;
  name: string;
  movement_pattern: string;
  equipment: string[];
  min_level: string;
  primary_muscles: string[];
};

type DraftItem = {
  exercise_id: string;
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
};

export default function CustomWorkout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [catalog, setCatalog] = useState<CatalogExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("Meu treino");
  const [draft, setDraft] = useState<DraftItem[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await api.get("/exercises/catalog");
      setCatalog(d.exercises || []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const draftIds = useMemo(() => new Set(draft.map((d) => d.exercise_id)), [draft]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter(
      (e) => !draftIds.has(e.id) && (!q || e.name.toLowerCase().includes(q)),
    );
  }, [catalog, query, draftIds]);

  const addExercise = (ex: CatalogExercise) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDraft((prev) => [
      ...prev,
      { exercise_id: ex.id, name: ex.name, sets: 3, reps: "10", rest_seconds: 60 },
    ]);
  };

  const updateItem = (id: string, patch: Partial<DraftItem>) => {
    setDraft((prev) => prev.map((d) => (d.exercise_id === id ? { ...d, ...patch } : d)));
  };

  const removeItem = (id: string) => {
    setDraft((prev) => prev.filter((d) => d.exercise_id !== id));
  };

  const start = async () => {
    if (draft.length === 0) return;
    setStarting(true);
    setError("");
    try {
      await api.post("/training/custom/start", {
        title: title.trim() || "Meu treino",
        items: draft.map((d) => ({
          exercise_id: d.exercise_id,
          sets: d.sets,
          reps: d.reps.trim() || null,
          rest_seconds: d.rest_seconds,
        })),
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      router.replace("/session");
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e.message || "Falha ao iniciar o treino.");
      setStarting(false);
    }
  };

  const header = (
    <View>
      <Input
        label="Nome do treino"
        value={title}
        onChangeText={setTitle}
        placeholder="Ex: Força — inferiores"
      />

      {draft.length > 0 && (
        <>
          <SectionHeader title={`Selecionados · ${draft.length}`} />
          {draft.map((item) => (
            <View key={item.exercise_id} style={[s.draftCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={s.draftHead}>
                <Text style={[s.draftName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                <Pressable onPress={() => removeItem(item.exercise_id)} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>
              <View style={s.draftControls}>
                <Stepper
                  label="Séries"
                  value={item.sets}
                  min={1}
                  max={10}
                  onChange={(v: number) => updateItem(item.exercise_id, { sets: v })}
                  colors={colors}
                />
                <View style={s.repsWrap}>
                  <Text style={[s.controlLabel, { color: colors.textSecondary }]}>Reps</Text>
                  <TextInput
                    style={[s.repsInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                    value={item.reps}
                    onChangeText={(v) => updateItem(item.exercise_id, { reps: v })}
                    placeholder="10"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <Stepper
                  label="Descanso"
                  value={item.rest_seconds}
                  min={0}
                  max={300}
                  step={15}
                  suffix="s"
                  onChange={(v: number) => updateItem(item.exercise_id, { rest_seconds: v })}
                  colors={colors}
                />
              </View>
            </View>
          ))}
        </>
      )}

      <SectionHeader title="Adicionar exercício" />
      <Input
        icon="search-outline"
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar exercício..."
        autoCapitalize="none"
      />
      <View style={{ height: spacing.md }} />
    </View>
  );

  if (loading) {
    return (
      <Screen>
        <ScreenHeader title="Montar treino" onBack={() => router.back()} />
        <LoadingState full />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Montar treino" onBack={() => router.back()} />
      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingBottom: insets.bottom + 96,
        }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => addExercise(item)}
            style={({ pressed }) => [
              s.catalogRow,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.85 },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.catalogName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
              <View style={s.catalogMeta}>
                <Chip label={LEVEL_LABEL[item.min_level] || item.min_level} tone="neutral" />
                {item.primary_muscles?.[0] ? (
                  <Text style={[s.catalogMuscle, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.primary_muscles.slice(0, 2).join(", ")}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={[s.addBtn, { backgroundColor: colors.accentMuted }]}>
              <Ionicons name="add" size={20} color={colors.accent} />
            </View>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          <EmptyState icon="search-outline" title="Nenhum exercício" text="Ajuste a busca para encontrar exercícios." />
        }
        showsVerticalScrollIndicator={false}
      />

      {draft.length > 0 && (
        <View style={[s.bottomBar, { paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.bg, borderTopColor: colors.border }]}>
          {error ? <Text style={[s.error, { color: colors.error }]}>{error}</Text> : null}
          <PrimaryButton
            label={starting ? "Iniciando..." : `Iniciar treino · ${draft.length}`}
            icon="play"
            onPress={start}
            loading={starting}
          />
        </View>
      )}
    </Screen>
  );
}

function Stepper({ label, value, min, max, step = 1, suffix = "", onChange, colors }: any) {
  return (
    <View style={s.stepper}>
      <Text style={[s.controlLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View style={s.stepperControls}>
        <Pressable
          onPress={() => onChange(Math.max(min, value - step))}
          style={[s.stepBtn, { borderColor: colors.border }]}
        >
          <Ionicons name="remove" size={16} color={colors.textSecondary} />
        </Pressable>
        <Text style={[s.stepValue, { color: colors.text }]}>{value}{suffix}</Text>
        <Pressable
          onPress={() => onChange(Math.min(max, value + step))}
          style={[s.stepBtn, { borderColor: colors.border }]}
        >
          <Ionicons name="add" size={16} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  draftCard: {
    borderRadius: radius.card, borderWidth: 1,
    padding: spacing.lg, marginBottom: spacing.sm,
  },
  draftHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  draftName: { fontFamily: fonts.semibold, ...type.body, flex: 1, marginRight: spacing.sm },
  draftControls: {
    flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between",
    marginTop: spacing.md, gap: spacing.md,
  },
  controlLabel: {
    fontFamily: fonts.medium, ...type.caption, letterSpacing: 1,
    textTransform: "uppercase", marginBottom: spacing.xs,
  },
  stepper: {},
  stepperControls: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  stepBtn: {
    width: 34, height: 34, borderRadius: radius.pill, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  stepValue: {
    fontFamily: fonts.bold, ...type.body, minWidth: 40, textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  repsWrap: { flex: 1 },
  repsInput: {
    height: 34, borderRadius: radius.md, borderWidth: 1,
    fontFamily: fonts.text, ...type.body, textAlign: "center",
  },

  catalogRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    borderRadius: radius.card, borderWidth: 1, padding: spacing.lg,
  },
  catalogName: { fontFamily: fonts.semibold, ...type.body },
  catalogMeta: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  catalogMuscle: { fontFamily: fonts.text, ...type.caption, flex: 1 },
  addBtn: {
    width: 40, height: 40, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
  },

  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing.xl, paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.sm,
  },
  error: { fontFamily: fonts.text, ...type.bodySmall, textAlign: "center" },
});
