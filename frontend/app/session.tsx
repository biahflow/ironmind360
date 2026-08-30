import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  TextInput, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { spacing, radius, fonts, type as tp, shadow } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/lib/api";
import MuscleMap from "@/src/components/MuscleMap";

const PHASE_LABEL: Record<string, string> = {
  warmup: "Aquecimento",
  strength: "Força",
  stability: "Estabilidade",
  circuit: "Circuito",
  cooldown: "Mobilidade",
};
const PHASE_ICON: Record<string, string> = {
  warmup: "flame-outline",
  strength: "barbell-outline",
  stability: "body-outline",
  circuit: "flash-outline",
  cooldown: "leaf-outline",
};

type SessionExercise = {
  exercise_id: string;
  phase: string;
  sets: number;
  reps?: string;
  duration_seconds?: number;
  rest_seconds: number;
  rpe_target?: number;
  tempo?: string;
  notes?: string;
  exercise?: {
    id: string;
    name: string;
    movement_pattern: string;
    instructions: string;
    common_errors: string;
    primary_muscles: string[];
    secondary_muscles: string[];
  };
};

type SetEntry = {
  set_number: number;
  reps: string;
  weight_kg: string;
  rpe: string;
  completed: boolean;
  saved: boolean;
};

type SessionData = {
  id: string;
  session_number: number;
  week: number;
  day: string;
  title: string;
  is_deload: boolean;
  exercises: { exercise_id: string; sets: { set_number: number; reps?: number; weight_kg?: number; rpe?: number }[] }[];
  status: string;
};

export default function SessionScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionData | null>(null);
  const [programExercises, setProgramExercises] = useState<SessionExercise[]>([]);
  const [currentExIdx, setCurrentExIdx] = useState(0);
  const [sets, setSets] = useState<SetEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const { session: sess, resumed } = await api.post("/training/sessions/start");
      setSession(sess);

      const plan = await api.get("/training/active");
      if (plan?.plan) {
        const progData = await api.get(
          `/programs/${plan.plan.program_id}/sessions/${sess.session_number}`
        );
        setProgramExercises(progData.exercises || []);

        if (resumed && sess.exercises?.length) {
          const lastExId = sess.exercises[sess.exercises.length - 1].exercise_id;
          const idx = (progData.exercises || []).findIndex(
            (e: SessionExercise) => e.exercise_id === lastExId
          );
          if (idx >= 0) setCurrentExIdx(idx);
        }
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const currentEx = programExercises[currentExIdx];

  useEffect(() => {
    if (!currentEx || !session) return;
    const existingLog = session.exercises?.find(
      (e) => e.exercise_id === currentEx.exercise_id
    );
    const newSets: SetEntry[] = [];
    for (let i = 1; i <= currentEx.sets; i++) {
      const logged = existingLog?.sets?.find((ss) => ss.set_number === i);
      newSets.push({
        set_number: i,
        reps: logged?.reps?.toString() || currentEx.reps || "",
        weight_kg: logged?.weight_kg?.toString() || "",
        rpe: logged?.rpe?.toString() || "",
        completed: !!logged,
        saved: !!logged,
      });
    }
    setSets(newSets);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-init only when exercise index or session changes
  }, [currentExIdx, currentEx?.exercise_id, session?.id]);

  const saveSet = async (idx: number) => {
    if (!currentEx || !session) return;
    const entry = sets[idx];
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.post("/training/sessions/log-set", {
        exercise_id: currentEx.exercise_id,
        set_number: entry.set_number,
        reps: entry.reps ? parseInt(entry.reps) : null,
        weight_kg: entry.weight_kg ? parseFloat(entry.weight_kg) : null,
        rpe: entry.rpe ? parseInt(entry.rpe) : null,
        completed: true,
      });
      setSets((prev) =>
        prev.map((ss, i) => (i === idx ? { ...ss, completed: true, saved: true } : ss))
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const allSetsComplete = sets.every((entry) => entry.completed);
  const isLastExercise = currentExIdx === programExercises.length - 1;

  const nextExercise = () => {
    if (isLastExercise) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentExIdx((p) => p + 1);
  };

  const prevExercise = () => {
    if (currentExIdx === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentExIdx((p) => p - 1);
  };

  const completeSession = async () => {
    setCompleting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      await api.post("/training/sessions/complete");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setCompleting(false);
    }
  };

  const confirmComplete = () => {
    Alert.alert(
      "Concluir sessão",
      "Tem certeza que deseja finalizar esta sessão?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Concluir", style: "default", onPress: completeSession },
      ]
    );
  };

  const fmtTimer = () => {
    const m = Math.floor(elapsed / 60);
    const sec = elapsed % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <View style={[s.root, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
        <View style={s.center}>
          <ActivityIndicator color={colors.brandPrimary} size="large" />
          <Text style={[s.loadingText, { color: colors.onSurfaceSecondary }]}>Preparando sessão...</Text>
        </View>
      </View>
    );
  }

  if (!session || !currentEx) {
    return (
      <View style={[s.root, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
        <View style={s.center}>
          <Ionicons name="alert-circle" size={48} color={colors.onSurfaceSecondary} />
          <Text style={[s.loadingText, { color: colors.onSurfaceSecondary }]}>Nenhuma sessão disponível</Text>
          <Pressable style={[s.backBtnLarge, { backgroundColor: colors.brandPrimary }]} onPress={() => router.back()}>
            <Text style={[s.backBtnLargeText, { color: colors.onBrandPrimary }]}>VOLTAR</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const exName = currentEx.exercise?.name || currentEx.exercise_id;

  return (
    <View style={[s.root, { backgroundColor: colors.surface }]}>
      {/* Top bar */}
      <View style={[s.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={[s.closeBtn, { backgroundColor: colors.surfaceTertiary }]}>
          <Ionicons name="close" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={s.topCenter}>
          <Text style={[s.topTitle, { color: colors.onSurface }]}>{session.title}</Text>
          <Text style={[s.topSub, { color: colors.onSurfaceSecondary }]}>
            Semana {session.week} · Dia {session.day}
            {session.is_deload ? " · Deload" : ""}
          </Text>
        </View>
        <View style={[s.timerBadge, { backgroundColor: colors.surfaceTertiary }]}>
          <Ionicons name="time-outline" size={14} color={colors.brandPrimary} />
          <Text style={[s.timerText, { color: colors.brandPrimary }]}>{fmtTimer()}</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={[s.progressTrack, { backgroundColor: colors.surfaceTertiary }]}>
        <View
          style={[
            s.progressFill,
            { width: `${((currentExIdx + 1) / programExercises.length) * 100}%`, backgroundColor: colors.brandPrimary },
          ]}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Exercise nav */}
        <View style={s.exNav}>
          <Pressable
            onPress={prevExercise}
            disabled={currentExIdx === 0}
            style={[s.navBtn, { backgroundColor: colors.surfaceTertiary }, currentExIdx === 0 && s.navBtnDisabled]}
          >
            <Ionicons name="chevron-back" size={20} color={currentExIdx === 0 ? colors.border : colors.onSurface} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={[s.exCounter, { color: colors.onSurface }]}>
              {currentExIdx + 1} / {programExercises.length}
            </Text>
            <View style={s.phaseBadge}>
              <Ionicons
                name={(PHASE_ICON[currentEx.phase] || "ellipse") as any}
                size={12}
                color={colors.brandPrimary}
              />
              <Text style={[s.phaseText, { color: colors.brandPrimary }]}>{PHASE_LABEL[currentEx.phase] || currentEx.phase}</Text>
            </View>
          </View>
          <Pressable
            onPress={nextExercise}
            disabled={isLastExercise}
            style={[s.navBtn, { backgroundColor: colors.surfaceTertiary }, isLastExercise && s.navBtnDisabled]}
          >
            <Ionicons name="chevron-forward" size={20} color={isLastExercise ? colors.border : colors.onSurface} />
          </Pressable>
        </View>

        {/* Muscle map */}
        {currentEx.exercise?.primary_muscles?.length ? (
          <View style={s.animationArea}>
            <MuscleMap
              primary={(currentEx.exercise.primary_muscles || []) as any[]}
              secondary={(currentEx.exercise.secondary_muscles || []) as any[]}
              size={56}
            />
          </View>
        ) : null}

        {/* Exercise name + info link */}
        <Pressable
          style={s.exHeader}
          onPress={() => router.push({ pathname: "/exercise-detail", params: { id: currentEx.exercise_id } })}
        >
          <Text style={[s.exName, { color: colors.onSurface }]}>{exName}</Text>
          <Ionicons name="information-circle-outline" size={22} color={colors.brandPrimary} />
        </Pressable>

        {/* Prescription */}
        <View style={s.prescriptionRow}>
          {currentEx.reps && (
            <View style={[s.prescriptionItem, { backgroundColor: colors.cardBackground, ...(isDark ? {} : shadow.sm) }]}>
              <Text style={[s.prescriptionValue, { color: colors.onSurface }]}>{currentEx.reps}</Text>
              <Text style={[s.prescriptionLabel, { color: colors.onSurfaceSecondary }]}>REPS</Text>
            </View>
          )}
          {currentEx.duration_seconds && (
            <View style={[s.prescriptionItem, { backgroundColor: colors.cardBackground, ...(isDark ? {} : shadow.sm) }]}>
              <Text style={[s.prescriptionValue, { color: colors.onSurface }]}>{currentEx.duration_seconds}s</Text>
              <Text style={[s.prescriptionLabel, { color: colors.onSurfaceSecondary }]}>DURAÇÃO</Text>
            </View>
          )}
          <View style={[s.prescriptionItem, { backgroundColor: colors.cardBackground, ...(isDark ? {} : shadow.sm) }]}>
            <Text style={[s.prescriptionValue, { color: colors.onSurface }]}>{currentEx.sets}</Text>
            <Text style={[s.prescriptionLabel, { color: colors.onSurfaceSecondary }]}>SÉRIES</Text>
          </View>
          <View style={[s.prescriptionItem, { backgroundColor: colors.cardBackground, ...(isDark ? {} : shadow.sm) }]}>
            <Text style={[s.prescriptionValue, { color: colors.onSurface }]}>{currentEx.rest_seconds}s</Text>
            <Text style={[s.prescriptionLabel, { color: colors.onSurfaceSecondary }]}>DESCANSO</Text>
          </View>
          {currentEx.rpe_target && (
            <View style={[s.prescriptionItem, { backgroundColor: colors.cardBackground, ...(isDark ? {} : shadow.sm) }]}>
              <Text style={[s.prescriptionValue, { color: colors.onSurface }]}>{currentEx.rpe_target}</Text>
              <Text style={[s.prescriptionLabel, { color: colors.onSurfaceSecondary }]}>RPE</Text>
            </View>
          )}
        </View>

        {currentEx.tempo && (
          <Text style={[s.tempoHint, { color: colors.brandPrimary }]}>Tempo: {currentEx.tempo}</Text>
        )}
        {currentEx.notes && (
          <Text style={[s.notesHint, { color: colors.onSurfaceSecondary }]}>{currentEx.notes}</Text>
        )}

        {/* Sets */}
        <View style={[s.setsHeader, { borderBottomColor: colors.divider }]}>
          <Text style={[s.setCol, { flex: 0.5, color: colors.onSurfaceSecondary }]}>Série</Text>
          <Text style={[s.setCol, { color: colors.onSurfaceSecondary }]}>Reps</Text>
          <Text style={[s.setCol, { color: colors.onSurfaceSecondary }]}>Kg</Text>
          <Text style={[s.setCol, { color: colors.onSurfaceSecondary }]}>RPE</Text>
          <View style={{ width: 48 }} />
        </View>

        {sets.map((entry, idx) => (
          <View key={entry.set_number} style={[s.setRow, entry.completed && { backgroundColor: colors.surfaceTertiary, opacity: 0.7 }]}>
            <Text style={[s.setNum, { flex: 0.5, color: colors.onSurfaceSecondary }]}>{entry.set_number}</Text>
            <TextInput
              style={[s.setInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.onSurface }]}
              value={entry.reps}
              onChangeText={(v) =>
                setSets((prev) => prev.map((ss, i) => (i === idx ? { ...ss, reps: v } : ss)))
              }
              keyboardType="numeric"
              placeholder="—"
              placeholderTextColor={colors.border}
              editable={!entry.completed}
            />
            <TextInput
              style={[s.setInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.onSurface }]}
              value={entry.weight_kg}
              onChangeText={(v) =>
                setSets((prev) => prev.map((ss, i) => (i === idx ? { ...ss, weight_kg: v } : ss)))
              }
              keyboardType="decimal-pad"
              placeholder="—"
              placeholderTextColor={colors.border}
              editable={!entry.completed}
            />
            <TextInput
              style={[s.setInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.onSurface }]}
              value={entry.rpe}
              onChangeText={(v) =>
                setSets((prev) => prev.map((ss, i) => (i === idx ? { ...ss, rpe: v } : ss)))
              }
              keyboardType="numeric"
              placeholder="—"
              placeholderTextColor={colors.border}
              editable={!entry.completed}
            />
            {entry.completed ? (
              <View style={[s.checkDone, { backgroundColor: colors.surfaceTertiary }]}>
                <Ionicons name="checkmark" size={18} color={colors.success} />
              </View>
            ) : (
              <Pressable
                style={[s.checkBtn, { backgroundColor: colors.brandPrimary }]}
                onPress={() => saveSet(idx)}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.onBrandPrimary} size="small" />
                ) : (
                  <Ionicons name="checkmark" size={18} color={colors.onBrandPrimary} />
                )}
              </Pressable>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Bottom action */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.surface, borderTopColor: colors.divider }]}>
        {allSetsComplete && isLastExercise ? (
          <Pressable
            style={[s.completeBtn, { backgroundColor: colors.success, ...shadow.glow(colors.success) }]}
            onPress={confirmComplete}
            disabled={completing}
          >
            {completing ? (
              <ActivityIndicator color={colors.onBrandPrimary} size="small" />
            ) : (
              <>
                <Ionicons name="trophy" size={20} color={colors.onBrandPrimary} />
                <Text style={[s.completeBtnText, { color: colors.onBrandPrimary }]}>CONCLUIR SESSÃO</Text>
              </>
            )}
          </Pressable>
        ) : allSetsComplete && !isLastExercise ? (
          <Pressable style={[s.nextBtn, { backgroundColor: colors.brandPrimary, ...shadow.glow(colors.brandPrimary) }]} onPress={nextExercise}>
            <Text style={[s.nextBtnText, { color: colors.onBrandPrimary }]}>PRÓXIMO EXERCÍCIO</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.onBrandPrimary} />
          </Pressable>
        ) : (
          <View style={[s.hintBar, { backgroundColor: colors.cardBackground, ...(isDark ? {} : shadow.sm) }]}>
            <Text style={[s.hintText, { color: colors.onSurfaceSecondary }]}>
              Complete todas as séries para avançar
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  loadingText: { fontFamily: fonts.text, fontSize: tp.base },
  backBtnLarge: {
    paddingHorizontal: spacing["2xl"],
    height: 52, borderRadius: radius.pill, alignItems: "center", justifyContent: "center",
    marginTop: spacing.lg,
  },
  backBtnLargeText: { fontFamily: fonts.bold, fontSize: tp.base },

  topBar: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.sm,
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
  },
  topCenter: { flex: 1, alignItems: "center" },
  topTitle: { fontFamily: fonts.display, fontSize: tp.xl, letterSpacing: 1 },
  topSub: { fontFamily: fonts.mono, fontSize: tp.sm },
  timerBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: spacing.md,
    height: 36, borderRadius: radius.pill,
  },
  timerText: { fontFamily: fonts.mono, fontSize: tp.sm },

  progressTrack: { height: 3 },
  progressFill: { height: 3 },

  exNav: {
    flexDirection: "row", alignItems: "center", marginBottom: spacing.lg,
  },
  navBtn: {
    width: 44, height: 44, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
  },
  navBtnDisabled: { opacity: 0.3 },
  exCounter: { fontFamily: fonts.display, fontSize: tp.xl },
  phaseBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  phaseText: { fontFamily: fonts.medium, fontSize: tp.sm },

  animationArea: {
    alignItems: "center", marginBottom: spacing.md,
  },
  exHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  exName: { fontFamily: fonts.display, fontSize: tp["3xl"], letterSpacing: 1, flex: 1 },

  prescriptionRow: {
    flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md,
  },
  prescriptionItem: {
    flex: 1, borderRadius: radius.lg,
    paddingVertical: spacing.lg, alignItems: "center",
  },
  prescriptionValue: { fontFamily: fonts.display, fontSize: tp.xl },
  prescriptionLabel: { fontFamily: fonts.medium, fontSize: 9, letterSpacing: 1, marginTop: 2 },

  tempoHint: {
    fontFamily: fonts.mono, fontSize: tp.sm,
    marginBottom: spacing.xs,
  },
  notesHint: {
    fontFamily: fonts.text, fontSize: tp.sm,
    marginBottom: spacing.md, fontStyle: "italic",
  },

  setsHeader: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.xs,
  },
  setCol: {
    flex: 1, fontFamily: fonts.bold, fontSize: 10,
    letterSpacing: 1, textAlign: "center",
  },

  setRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.sm,
    borderRadius: radius.md, marginBottom: spacing.xs,
  },
  setNum: {
    fontFamily: fonts.display, fontSize: tp.xl,
    textAlign: "center",
  },
  setInput: {
    flex: 1, height: 44, borderRadius: radius.md,
    borderWidth: 1,
    fontFamily: fonts.mono, fontSize: tp.base,
    textAlign: "center",
  },
  checkBtn: {
    width: 48, height: 44, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
  },
  checkDone: {
    width: 48, height: 44, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
  },

  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  completeBtn: {
    flexDirection: "row", gap: spacing.sm, height: 56, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
  },
  completeBtnText: { fontFamily: fonts.bold, fontSize: tp.lg, letterSpacing: 1 },
  nextBtn: {
    flexDirection: "row", gap: spacing.sm, height: 56, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
  },
  nextBtnText: { fontFamily: fonts.bold, fontSize: tp.lg, letterSpacing: 1 },
  hintBar: {
    height: 56, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
  },
  hintText: { fontFamily: fonts.medium, fontSize: tp.base },
});
