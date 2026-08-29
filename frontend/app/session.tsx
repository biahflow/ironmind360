import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  TextInput, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, spacing, radius, fonts, type as tp } from "@/src/theme";
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
      const logged = existingLog?.sets?.find((s) => s.set_number === i);
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
    const s = sets[idx];
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.post("/training/sessions/log-set", {
        exercise_id: currentEx.exercise_id,
        set_number: s.set_number,
        reps: s.reps ? parseInt(s.reps) : null,
        weight_kg: s.weight_kg ? parseFloat(s.weight_kg) : null,
        rpe: s.rpe ? parseInt(s.rpe) : null,
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

  const allSetsComplete = sets.every((s) => s.completed);
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
    const s = elapsed % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} size="large" />
          <Text style={styles.loadingText}>Preparando sessão...</Text>
        </View>
      </View>
    );
  }

  if (!session || !currentEx) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.center}>
          <Ionicons name="alert-circle" size={48} color={colors.onSurfaceSecondary} />
          <Text style={styles.loadingText}>Nenhuma sessão disponível</Text>
          <Pressable style={styles.backBtnLarge} onPress={() => router.back()}>
            <Text style={styles.backBtnLargeText}>VOLTAR</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const exName = currentEx.exercise?.name || currentEx.exercise_id;

  return (
    <View style={styles.root}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={styles.topCenter}>
          <Text style={styles.topTitle}>{session.title}</Text>
          <Text style={styles.topSub}>
            Semana {session.week} · Dia {session.day}
            {session.is_deload ? " · Deload" : ""}
          </Text>
        </View>
        <View style={styles.timerBadge}>
          <Ionicons name="time-outline" size={14} color={colors.brandSecondary} />
          <Text style={styles.timerText}>{fmtTimer()}</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${((currentExIdx + 1) / programExercises.length) * 100}%` },
          ]}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Exercise nav */}
        <View style={styles.exNav}>
          <Pressable
            onPress={prevExercise}
            disabled={currentExIdx === 0}
            style={[styles.navBtn, currentExIdx === 0 && styles.navBtnDisabled]}
          >
            <Ionicons name="chevron-back" size={20} color={currentExIdx === 0 ? colors.border : colors.onSurface} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.exCounter}>
              {currentExIdx + 1} / {programExercises.length}
            </Text>
            <View style={styles.phaseBadge}>
              <Ionicons
                name={(PHASE_ICON[currentEx.phase] || "ellipse") as any}
                size={12}
                color={colors.brandSecondary}
              />
              <Text style={styles.phaseText}>{PHASE_LABEL[currentEx.phase] || currentEx.phase}</Text>
            </View>
          </View>
          <Pressable
            onPress={nextExercise}
            disabled={isLastExercise}
            style={[styles.navBtn, isLastExercise && styles.navBtnDisabled]}
          >
            <Ionicons name="chevron-forward" size={20} color={isLastExercise ? colors.border : colors.onSurface} />
          </Pressable>
        </View>

        {/* Muscle map */}
        {currentEx.exercise?.primary_muscles?.length ? (
          <View style={styles.animationArea}>
            <MuscleMap
              primary={(currentEx.exercise.primary_muscles || []) as any[]}
              secondary={(currentEx.exercise.secondary_muscles || []) as any[]}
              size={56}
            />
          </View>
        ) : null}

        {/* Exercise name + info link */}
        <Pressable
          style={styles.exHeader}
          onPress={() => router.push({ pathname: "/exercise-detail", params: { id: currentEx.exercise_id } })}
        >
          <Text style={styles.exName}>{exName}</Text>
          <Ionicons name="information-circle-outline" size={22} color={colors.brandSecondary} />
        </Pressable>

        {/* Prescription */}
        <View style={styles.prescriptionRow}>
          {currentEx.reps && (
            <View style={styles.prescriptionItem}>
              <Text style={styles.prescriptionValue}>{currentEx.reps}</Text>
              <Text style={styles.prescriptionLabel}>REPS</Text>
            </View>
          )}
          {currentEx.duration_seconds && (
            <View style={styles.prescriptionItem}>
              <Text style={styles.prescriptionValue}>{currentEx.duration_seconds}s</Text>
              <Text style={styles.prescriptionLabel}>DURAÇÃO</Text>
            </View>
          )}
          <View style={styles.prescriptionItem}>
            <Text style={styles.prescriptionValue}>{currentEx.sets}</Text>
            <Text style={styles.prescriptionLabel}>SÉRIES</Text>
          </View>
          <View style={styles.prescriptionItem}>
            <Text style={styles.prescriptionValue}>{currentEx.rest_seconds}s</Text>
            <Text style={styles.prescriptionLabel}>DESCANSO</Text>
          </View>
          {currentEx.rpe_target && (
            <View style={styles.prescriptionItem}>
              <Text style={styles.prescriptionValue}>{currentEx.rpe_target}</Text>
              <Text style={styles.prescriptionLabel}>RPE</Text>
            </View>
          )}
        </View>

        {currentEx.tempo && (
          <Text style={styles.tempoHint}>Tempo: {currentEx.tempo}</Text>
        )}
        {currentEx.notes && (
          <Text style={styles.notesHint}>{currentEx.notes}</Text>
        )}

        {/* Sets */}
        <View style={styles.setsHeader}>
          <Text style={[styles.setCol, { flex: 0.5 }]}>Série</Text>
          <Text style={styles.setCol}>Reps</Text>
          <Text style={styles.setCol}>Kg</Text>
          <Text style={styles.setCol}>RPE</Text>
          <View style={{ width: 48 }} />
        </View>

        {sets.map((s, idx) => (
          <View key={s.set_number} style={[styles.setRow, s.completed && styles.setRowDone]}>
            <Text style={[styles.setNum, { flex: 0.5 }]}>{s.set_number}</Text>
            <TextInput
              style={styles.setInput}
              value={s.reps}
              onChangeText={(v) =>
                setSets((prev) => prev.map((ss, i) => (i === idx ? { ...ss, reps: v } : ss)))
              }
              keyboardType="numeric"
              placeholder="—"
              placeholderTextColor={colors.border}
              editable={!s.completed}
            />
            <TextInput
              style={styles.setInput}
              value={s.weight_kg}
              onChangeText={(v) =>
                setSets((prev) => prev.map((ss, i) => (i === idx ? { ...ss, weight_kg: v } : ss)))
              }
              keyboardType="decimal-pad"
              placeholder="—"
              placeholderTextColor={colors.border}
              editable={!s.completed}
            />
            <TextInput
              style={styles.setInput}
              value={s.rpe}
              onChangeText={(v) =>
                setSets((prev) => prev.map((ss, i) => (i === idx ? { ...ss, rpe: v } : ss)))
              }
              keyboardType="numeric"
              placeholder="—"
              placeholderTextColor={colors.border}
              editable={!s.completed}
            />
            {s.completed ? (
              <View style={styles.checkDone}>
                <Ionicons name="checkmark" size={18} color={colors.success} />
              </View>
            ) : (
              <Pressable
                style={styles.checkBtn}
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
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        {allSetsComplete && isLastExercise ? (
          <Pressable
            style={styles.completeBtn}
            onPress={confirmComplete}
            disabled={completing}
          >
            {completing ? (
              <ActivityIndicator color={colors.onBrandPrimary} size="small" />
            ) : (
              <>
                <Ionicons name="trophy" size={20} color={colors.onBrandPrimary} />
                <Text style={styles.completeBtnText}>CONCLUIR SESSÃO</Text>
              </>
            )}
          </Pressable>
        ) : allSetsComplete && !isLastExercise ? (
          <Pressable style={styles.nextBtn} onPress={nextExercise}>
            <Text style={styles.nextBtnText}>PRÓXIMO EXERCÍCIO</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.onBrandPrimary} />
          </Pressable>
        ) : (
          <View style={styles.hintBar}>
            <Text style={styles.hintText}>
              Complete todas as séries para avançar
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  loadingText: { fontFamily: fonts.text, fontSize: tp.base, color: colors.onSurfaceSecondary },
  backBtnLarge: {
    backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.xl,
    height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center",
    marginTop: spacing.lg,
  },
  backBtnLargeText: { fontFamily: fonts.bold, fontSize: tp.base, color: colors.onBrandPrimary },

  topBar: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.sm,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  topCenter: { flex: 1, alignItems: "center" },
  topTitle: { fontFamily: fonts.display, fontSize: tp.xl, color: colors.onSurface, letterSpacing: 1 },
  topSub: { fontFamily: fonts.mono, fontSize: tp.sm, color: colors.onSurfaceSecondary },
  timerBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.sm,
    height: 32, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  timerText: { fontFamily: fonts.mono, fontSize: tp.sm, color: colors.brandSecondary },

  progressTrack: {
    height: 3, backgroundColor: colors.surfaceTertiary,
  },
  progressFill: { height: 3, backgroundColor: colors.brandPrimary },

  exNav: {
    flexDirection: "row", alignItems: "center", marginBottom: spacing.lg,
  },
  navBtn: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  navBtnDisabled: { opacity: 0.3 },
  exCounter: { fontFamily: fonts.display, fontSize: tp.xl, color: colors.onSurface },
  phaseBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  phaseText: { fontFamily: fonts.medium, fontSize: tp.sm, color: colors.brandSecondary },

  animationArea: {
    alignItems: "center", marginBottom: spacing.md,
  },
  exHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  exName: { fontFamily: fonts.display, fontSize: tp["3xl"], color: colors.onSurface, letterSpacing: 1, flex: 1 },

  prescriptionRow: {
    flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md,
  },
  prescriptionItem: {
    flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
    paddingVertical: spacing.md, alignItems: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  prescriptionValue: { fontFamily: fonts.display, fontSize: tp.xl, color: colors.onSurface },
  prescriptionLabel: { fontFamily: fonts.medium, fontSize: 9, color: colors.onSurfaceSecondary, letterSpacing: 1, marginTop: 2 },

  tempoHint: {
    fontFamily: fonts.mono, fontSize: tp.sm, color: colors.brandSecondary,
    marginBottom: spacing.xs,
  },
  notesHint: {
    fontFamily: fonts.text, fontSize: tp.sm, color: colors.onSurfaceSecondary,
    marginBottom: spacing.md, fontStyle: "italic",
  },

  setsHeader: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider,
    marginBottom: spacing.xs,
  },
  setCol: {
    flex: 1, fontFamily: fonts.bold, fontSize: 10, color: colors.onSurfaceSecondary,
    letterSpacing: 1, textAlign: "center",
  },

  setRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.sm,
    borderRadius: radius.md, marginBottom: spacing.xs,
  },
  setRowDone: { backgroundColor: colors.surfaceSecondary, opacity: 0.7 },
  setNum: {
    fontFamily: fonts.display, fontSize: tp.xl, color: colors.onSurfaceSecondary,
    textAlign: "center",
  },
  setInput: {
    flex: 1, height: 44, borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border,
    fontFamily: fonts.mono, fontSize: tp.base, color: colors.onSurface,
    textAlign: "center",
  },
  checkBtn: {
    width: 48, height: 44, borderRadius: radius.md,
    backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center",
  },
  checkDone: {
    width: 48, height: 44, borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center",
  },

  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider,
  },
  completeBtn: {
    flexDirection: "row", gap: spacing.sm, height: 56, borderRadius: radius.md,
    backgroundColor: colors.success, alignItems: "center", justifyContent: "center",
  },
  completeBtnText: { fontFamily: fonts.bold, fontSize: tp.lg, color: colors.onBrandPrimary, letterSpacing: 1 },
  nextBtn: {
    flexDirection: "row", gap: spacing.sm, height: 56, borderRadius: radius.md,
    backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center",
  },
  nextBtnText: { fontFamily: fonts.bold, fontSize: tp.lg, color: colors.onBrandPrimary, letterSpacing: 1 },
  hintBar: {
    height: 56, borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  hintText: { fontFamily: fonts.medium, fontSize: tp.base, color: colors.onSurfaceSecondary },
});
