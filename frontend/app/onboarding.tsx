import React, { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { spacing, radius, fonts, type as tp, controlHeight } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/lib/api";
import { Screen, PrimaryButton, SecondaryButton, Overline } from "@/src/components/ui";

const TOTAL_STEPS = 5;

type Discipline = "swim" | "bike" | "run";
type Modality = "triathlon" | "running";
type Experience = "none" | "beginner" | "recreational" | "competitive" | "elite";
type Environment = "home" | "gym" | "both";
type ComplementaryLevel = "beginner" | "intermediate" | "advanced";

const MODALITY_LABELS: Record<Modality, string> = { triathlon: "Triatlo", running: "Corrida" };
const MODALITY_DISCIPLINES: Record<Modality, Discipline[]> = {
  triathlon: ["swim", "bike", "run"],
  running: ["run"],
};
const EXPERIENCE_LABELS: Record<Experience, string> = {
  none: "Nenhuma", beginner: "Iniciante", recreational: "Recreativo",
  competitive: "Competitivo", elite: "Elite",
};
const ENV_LABELS: Record<Environment, string> = { home: "Casa", gym: "Academia", both: "Ambos" };
const LEVEL_LABELS: Record<ComplementaryLevel, string> = {
  beginner: "Iniciante", intermediate: "Intermediário", advanced: "Avançado",
};

function TagInput({ label, items, setItems, colors }: {
  label: string; items: string[]; setItems: (v: string[]) => void; colors: any;
}) {
  const [text, setText] = useState("");
  const add = () => {
    const trimmed = text.trim();
    if (trimmed && !items.includes(trimmed)) {
      setItems([...items, trimmed]);
    }
    setText("");
  };
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <TextInput
          style={[s.tagInput, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border, flex: 1 }]}
          value={text}
          onChangeText={setText}
          placeholder="Adicionar..."
          placeholderTextColor={colors.textSecondary}
          onSubmitEditing={add}
          returnKeyType="done"
          blurOnSubmit={false}
        />
        <Pressable onPress={add} style={[s.addBtn, { backgroundColor: colors.accentMuted }]}>
          <Ionicons name="add" size={20} color={colors.accent} />
        </Pressable>
      </View>
      {items.length > 0 && (
        <View style={s.tagList}>
          {items.map((item, i) => (
            <View key={i} style={[s.tag, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontFamily: fonts.text, ...tp.bodySmall }}>{item}</Text>
              <Pressable onPress={() => setItems(items.filter((_, j) => j !== i))}>
                <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function Onboarding() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const LEVEL_COLOR: Record<ComplementaryLevel, string> = {
    beginner: colors.success, intermediate: colors.warning, advanced: colors.error,
  };
  const LEVEL_MUTED: Record<ComplementaryLevel, string> = {
    beginner: colors.successMuted, intermediate: colors.warningMuted, advanced: colors.errorMuted,
  };

  // Step 1
  const [modalities, setModalities] = useState<Modality[]>(["triathlon"]);
  const disciplines = React.useMemo<Discipline[]>(() => {
    const set = new Set<Discipline>();
    modalities.forEach((m) => MODALITY_DISCIPLINES[m].forEach((d) => set.add(d)));
    return Array.from(set);
  }, [modalities]);
  const [experience, setExperience] = useState<Experience>("beginner");
  const [availDays, setAvailDays] = useState(3);
  const [availHours, setAvailHours] = useState(6);
  const [environment, setEnvironment] = useState<Environment>("home");

  // Step 2
  const [strengthMonths, setStrengthMonths] = useState(0);
  const [activeDays, setActiveDays] = useState(3);
  const [sedentary, setSedentary] = useState(false);
  const [canSquat, setCanSquat] = useState(false);
  const [canHinge, setCanHinge] = useState(false);
  const [hasPain, setHasPain] = useState(false);

  // Step 3
  const [recommended, setRecommended] = useState<ComplementaryLevel>("beginner");
  const [reasons, setReasons] = useState<string[]>([]);
  const [levelOverride, setLevelOverride] = useState<ComplementaryLevel | null>(null);

  // Step 4
  const [allergies, setAllergies] = useState<string[]>([]);
  const [intolerances, setIntolerances] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<string[]>([]);
  const [disliked, setDisliked] = useState<string[]>([]);

  // Step 5
  const [intervalsKey, setIntervalsKey] = useState("");
  const [intervalsId, setIntervalsId] = useState("");

  const toggleModality = (m: Modality) => {
    setModalities(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  const submitSportProfile = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await api.put("/profile/sport", {
        disciplines,
        experience,
        weekly_availability_days: availDays,
        weekly_availability_hours: availHours,
        environment,
        equipment: [],
        restrictions: [],
        self_assessment: {
          strength_training_months: strengthMonths,
          weekly_active_days: activeDays,
          returning_from_sedentary: sedentary,
          can_squat_bodyweight: canSquat,
          can_hinge_pattern: canHinge,
          has_pain_or_injury: hasPain,
        },
        complementary_level_override: levelOverride,
      });
      setRecommended(res.complementary_level.recommended);
      setReasons(res.complementary_level.reasons || []);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep(2);
    } catch (e: any) {
      setError(e.message || "Falha ao salvar perfil");
    } finally {
      setBusy(false);
    }
  };

  const submitNutrition = async () => {
    setBusy(true);
    setError("");
    try {
      await api.put("/profile/nutrition", {
        allergies, intolerances, preferences, disliked_foods: disliked,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep(4);
    } catch (e: any) {
      setError(e.message || "Falha ao salvar perfil nutricional");
    } finally {
      setBusy(false);
    }
  };

  const submitIntervals = async () => {
    setBusy(true);
    setError("");
    try {
      const payload: any = { intervals_athlete_id: intervalsId };
      if (intervalsKey.trim()) payload.intervals_api_key = intervalsKey.trim();
      await api.put("/settings", payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e.message || "Falha ao conectar intervals.icu");
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (intervalsKey.trim() && intervalsId.trim()) {
      await submitIntervals();
    }
    await refreshUser();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace("/(tabs)");
  };

  const next = () => {
    setError("");
    if (step === 1) {
      submitSportProfile();
      return;
    }
    if (step === 3) {
      submitNutrition();
      return;
    }
    if (step === 4) {
      finish();
      return;
    }
    setStep(s => s + 1);
  };

  const back = () => {
    setError("");
    if (step === 2) {
      setStep(1);
      return;
    }
    setStep(s => Math.max(0, s - 1));
  };

  const skipNutrition = () => {
    setError("");
    setStep(4);
  };

  const Chip = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.lg, height: 40, borderRadius: radius.pill, borderWidth: 1,
        borderColor: selected ? colors.accent : colors.border,
        backgroundColor: selected ? colors.accentMuted : colors.surface,
        flexDirection: "row", alignItems: "center", justifyContent: "center",
      }}
    >
      <Text style={{ color: selected ? colors.accent : colors.textSecondary, fontFamily: fonts.semibold, ...tp.bodySmall }}>
        {label}
      </Text>
    </Pressable>
  );

  const Stepper = ({ value, onChange, min, max, label }: {
    value: number; onChange: (v: number) => void; min: number; max: number; label: string;
  }) => (
    <View style={s.stepperRow}>
      <Text style={[s.stepperLabel, { color: colors.text }]}>{label}</Text>
      <View style={s.stepperControls}>
        <Pressable onPress={() => onChange(Math.max(min, value - 1))} style={[s.stepperBtn, { borderColor: colors.border }]}>
          <Ionicons name="remove" size={18} color={colors.textSecondary} />
        </Pressable>
        <Text style={[s.stepperValue, { color: colors.text }]}>{value}</Text>
        <Pressable onPress={() => onChange(Math.min(max, value + 1))} style={[s.stepperBtn, { borderColor: colors.border }]}>
          <Ionicons name="add" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );

  const ToggleRow = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <View style={s.toggleRow}>
      <Text style={[s.toggleLabel, { color: colors.text }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.accentMuted }}
        thumbColor={value ? colors.accent : colors.textSecondary}
      />
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={s.stepContent}>
            <Overline color={colors.accent}>Passo 1 de 5</Overline>
            <Text style={[s.stepTitle, { color: colors.text }]}>Perfil Esportivo</Text>
            <Text style={[s.stepDesc, { color: colors.textSecondary }]}>
              Conte-nos sobre sua prática esportiva para personalizar sua experiência.
            </Text>

            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Modalidades</Text>
            <View style={s.chipRow}>
              {(["triathlon", "running"] as Modality[]).map(m => (
                <Chip key={m} label={MODALITY_LABELS[m]} selected={modalities.includes(m)} onPress={() => toggleModality(m)} />
              ))}
            </View>

            <Text style={[s.fieldLabel, { color: colors.textSecondary, marginTop: spacing.xl }]}>Experiência</Text>
            <View style={s.chipRow}>
              {(["none", "beginner", "recreational", "competitive", "elite"] as Experience[]).map(e => (
                <Chip key={e} label={EXPERIENCE_LABELS[e]} selected={experience === e} onPress={() => setExperience(e)} />
              ))}
            </View>

            <View style={{ marginTop: spacing.xl }}>
              <Stepper value={availDays} onChange={setAvailDays} min={1} max={7} label="Dias por semana" />
              <Stepper value={availHours} onChange={setAvailHours} min={1} max={20} label="Horas por semana" />
            </View>

            <Text style={[s.fieldLabel, { color: colors.textSecondary, marginTop: spacing.xl }]}>Ambiente de treino</Text>
            <View style={s.chipRow}>
              {(["home", "gym", "both"] as Environment[]).map(e => (
                <Chip key={e} label={ENV_LABELS[e]} selected={environment === e} onPress={() => setEnvironment(e)} />
              ))}
            </View>
          </View>
        );

      case 1:
        return (
          <View style={s.stepContent}>
            <Overline color={colors.accent}>Passo 2 de 5</Overline>
            <Text style={[s.stepTitle, { color: colors.text }]}>Autoavaliação</Text>
            <Text style={[s.stepDesc, { color: colors.textSecondary }]}>
              Avalie seu nível atual para recomendarmos o programa ideal.
            </Text>

            <Stepper value={strengthMonths} onChange={setStrengthMonths} min={0} max={600} label="Meses de musculação" />
            <Stepper value={activeDays} onChange={setActiveDays} min={0} max={7} label="Dias ativos por semana" />

            <View style={{ marginTop: spacing.lg }}>
              <ToggleRow label="Voltando do sedentarismo" value={sedentary} onChange={setSedentary} />
              <ToggleRow label="Consigo agachar com peso corporal" value={canSquat} onChange={setCanSquat} />
              <ToggleRow label="Consigo fazer o padrão de dobradiça de quadril (hip hinge)" value={canHinge} onChange={setCanHinge} />
              <ToggleRow label="Tenho dor ou lesão ativa" value={hasPain} onChange={setHasPain} />
            </View>
          </View>
        );

      case 2:
        return (
          <View style={s.stepContent}>
            <Overline color={colors.accent}>Passo 3 de 5</Overline>
            <Text style={[s.stepTitle, { color: colors.text }]}>Seu Nível</Text>
            <Text style={[s.stepDesc, { color: colors.textSecondary }]}>
              Com base na sua avaliação, recomendamos o nível abaixo.
            </Text>

            <View style={[s.levelCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[s.levelBadge, { backgroundColor: LEVEL_MUTED[recommended] }]}>
                <Ionicons
                  name={recommended === "beginner" ? "leaf" : recommended === "intermediate" ? "fitness" : "flame"}
                  size={28}
                  color={LEVEL_COLOR[recommended]}
                />
              </View>
              <Text style={[s.levelTitle, { color: colors.text }]}>{LEVEL_LABELS[recommended]}</Text>
              {reasons.map((r, i) => (
                <View key={i} style={s.reasonRow}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
                  <Text style={[s.reasonText, { color: colors.textSecondary }]}>{r}</Text>
                </View>
              ))}
            </View>

            <Text style={[s.fieldLabel, { color: colors.textSecondary, marginTop: spacing["2xl"] }]}>
              Prefere outro nível?
            </Text>
            <View style={s.chipRow}>
              {(["beginner", "intermediate", "advanced"] as ComplementaryLevel[]).map(l => (
                <Chip
                  key={l}
                  label={LEVEL_LABELS[l]}
                  selected={(levelOverride || recommended) === l}
                  onPress={() => setLevelOverride(l === recommended ? null : l)}
                />
              ))}
            </View>
          </View>
        );

      case 3:
        return (
          <View style={s.stepContent}>
            <Overline color={colors.accent}>Passo 4 de 5</Overline>
            <Text style={[s.stepTitle, { color: colors.text }]}>Perfil Nutricional</Text>
            <Text style={[s.stepDesc, { color: colors.textSecondary }]}>
              Opcional — ajuda nas sugestões de refeições e hidratação.
            </Text>

            <TagInput label="Alergias" items={allergies} setItems={setAllergies} colors={colors} />
            <TagInput label="Intolerâncias" items={intolerances} setItems={setIntolerances} colors={colors} />
            <TagInput label="Preferências alimentares" items={preferences} setItems={setPreferences} colors={colors} />
            <TagInput label="Alimentos que não gosta" items={disliked} setItems={setDisliked} colors={colors} />
          </View>
        );

      case 4:
        return (
          <View style={s.stepContent}>
            <Overline color={colors.accent}>Passo 5 de 5</Overline>
            <Text style={[s.stepTitle, { color: colors.text }]}>intervals.icu</Text>
            <Text style={[s.stepDesc, { color: colors.textSecondary }]}>
              Conecte sua conta do intervals.icu para sincronizar treinos, carga e métricas automaticamente. Você pode pular e configurar depois.
            </Text>

            <View style={[s.intervalsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={s.intervalsRow}>
                <Ionicons name="sync-circle" size={24} color={colors.accent} />
                <Text style={[s.intervalsTitle, { color: colors.text }]}>Benefícios</Text>
              </View>
              {["Sincronização automática de treinos", "Carga de treino (TSS) em tempo real", "Readiness baseado em dados reais"].map((b, i) => (
                <View key={i} style={s.reasonRow}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
                  <Text style={[s.reasonText, { color: colors.textSecondary }]}>{b}</Text>
                </View>
              ))}
            </View>

            <Text style={[s.fieldLabel, { color: colors.textSecondary, marginTop: spacing.xl }]}>API Key</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
              value={intervalsKey}
              onChangeText={setIntervalsKey}
              placeholder="Cole sua API key"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              secureTextEntry
            />

            <Text style={[s.fieldLabel, { color: colors.textSecondary, marginTop: spacing.lg }]}>Athlete ID</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
              value={intervalsId}
              onChangeText={setIntervalsId}
              placeholder="Seu athlete ID (ex: i12345)"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
            />
          </View>
        );

      default:
        return null;
    }
  };

  const stepTitles = ["Esporte", "Avaliação", "Nível", "Nutrição", "intervals.icu"];

  return (
    <Screen>
      <KeyboardAwareScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: spacing.xl,
          paddingTop: insets.top + spacing.xl,
          paddingBottom: insets.bottom + spacing["3xl"],
        }}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.content}>
          {/* Step indicator */}
          <View style={s.indicator}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View key={i} style={s.dotCol}>
                <View
                  style={[
                    s.dot,
                    {
                      backgroundColor: i <= step ? colors.accent : colors.border,
                      width: i === step ? 28 : 8,
                    },
                  ]}
                />
                <Text style={[s.dotLabel, { color: i === step ? colors.accent : colors.textSecondary }]}>
                  {stepTitles[i]}
                </Text>
              </View>
            ))}
          </View>

          {/* Back button */}
          {step > 0 && (
            <Pressable onPress={back} style={s.backBtn}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
              <Text style={[s.backText, { color: colors.text }]}>Voltar</Text>
            </Pressable>
          )}

          {renderStep()}

          {error ? (
            <Text style={[s.error, { color: colors.error }]}>{error}</Text>
          ) : null}

          <View style={s.actions}>
            {step === 2 && levelOverride && levelOverride !== recommended && (
              <SecondaryButton
                label="Manter recomendação"
                onPress={() => { setLevelOverride(null); }}
                style={{ marginBottom: spacing.sm }}
              />
            )}

            {step === 3 && (
              <SecondaryButton
                label="Pular"
                onPress={skipNutrition}
                style={{ marginBottom: spacing.sm }}
              />
            )}

            <PrimaryButton
              label={step === 4 ? "Concluir" : step === 2 ? "Confirmar nível" : "Próximo"}
              onPress={step === 2 ? () => {
                if (levelOverride) {
                  setBusy(true);
                  api.put("/profile/sport", {
                    disciplines, experience,
                    weekly_availability_days: availDays,
                    weekly_availability_hours: availHours,
                    environment,
                    equipment: [], restrictions: [],
                    self_assessment: {
                      strength_training_months: strengthMonths,
                      weekly_active_days: activeDays,
                      returning_from_sedentary: sedentary,
                      can_squat_bodyweight: canSquat,
                      can_hinge_pattern: canHinge,
                      has_pain_or_injury: hasPain,
                    },
                    complementary_level_override: levelOverride,
                  }).then(() => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    setStep(3);
                  }).catch((e: any) => setError(e.message || "Erro"))
                    .finally(() => setBusy(false));
                } else {
                  setStep(3);
                }
              } : next}
              loading={busy}
            />
          </View>
        </View>
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  content: { flex: 1 },

  indicator: {
    flexDirection: "row", justifyContent: "center", alignItems: "flex-start",
    gap: spacing.sm, marginBottom: spacing["2xl"],
  },
  dotCol: { alignItems: "center", gap: 4 },
  dot: { height: 8, borderRadius: radius.pill },
  dotLabel: { fontFamily: fonts.text, fontSize: 9, letterSpacing: 0.5 },

  backBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  backText: { fontFamily: fonts.medium, ...tp.bodySmall },

  stepContent: { flex: 1, marginBottom: spacing.xl },
  stepTitle: { fontFamily: fonts.bold, ...tp.h1, marginTop: spacing.xs },
  stepDesc: { fontFamily: fonts.text, ...tp.body, marginTop: spacing.sm, marginBottom: spacing["2xl"], lineHeight: 22 },

  fieldLabel: {
    fontFamily: fonts.semibold, ...tp.bodySmall,
    textTransform: "uppercase", letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },

  stepperRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  stepperLabel: { fontFamily: fonts.text, ...tp.body, flex: 1 },
  stepperControls: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  stepperBtn: {
    width: 36, height: 36, borderRadius: radius.pill, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  stepperValue: { fontFamily: fonts.bold, ...tp.h2, minWidth: 32, textAlign: "center" },

  toggleRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  toggleLabel: { fontFamily: fonts.text, ...tp.body, flex: 1, marginRight: spacing.md },

  levelCard: {
    borderRadius: radius.cardLarge, padding: spacing["2xl"], borderWidth: 1,
    alignItems: "center", marginTop: spacing.lg,
  },
  levelBadge: {
    width: 64, height: 64, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.lg,
  },
  levelTitle: { fontFamily: fonts.bold, ...tp.h1, marginBottom: spacing.lg },
  reasonRow: {
    flexDirection: "row", alignItems: "flex-start", gap: spacing.sm,
    paddingVertical: 4, width: "100%",
  },
  reasonText: { fontFamily: fonts.text, ...tp.bodySmall, flex: 1 },

  tagInput: {
    height: 44, borderRadius: radius.lg, borderWidth: 1,
    paddingHorizontal: spacing.lg, fontFamily: fonts.text, ...tp.body,
  },
  addBtn: {
    width: 44, height: 44, borderRadius: radius.lg,
    alignItems: "center", justifyContent: "center",
  },
  tagList: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  tag: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    paddingHorizontal: spacing.md, height: 32, borderRadius: radius.pill,
    borderWidth: 1,
  },

  intervalsCard: {
    borderRadius: radius.cardLarge, padding: spacing.xl, borderWidth: 1,
    marginTop: spacing.lg,
  },
  intervalsRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    marginBottom: spacing.md,
  },
  intervalsTitle: { fontFamily: fonts.bold, ...tp.h2 },

  input: {
    height: controlHeight, borderRadius: radius.lg, borderWidth: 1,
    paddingHorizontal: spacing.lg, fontFamily: fonts.text, ...tp.body,
  },

  error: { fontFamily: fonts.text, ...tp.bodySmall, marginBottom: spacing.sm, textAlign: "center" },

  actions: { marginTop: spacing.lg },
});
