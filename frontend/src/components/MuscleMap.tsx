import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";
import { fonts, spacing } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";

type MuscleGroup =
  | "quadriceps" | "hamstrings" | "glutes" | "calves"
  | "chest" | "upper_back" | "lats" | "shoulders" | "deltoids"
  | "biceps" | "triceps" | "forearms"
  | "core" | "obliques" | "hip_flexors" | "adductors" | "abductors"
  | "rotator_cuff" | "scapular" | "erectors";

type Props = {
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
  size?: number;
};

// ── FRONT VIEW ──────────────────────────────────────
// viewBox="0 0 160 340"

const BODY_FRONT_OUTLINE =
  // Head
  "M80,12 C88,12 94,18 94,28 C94,38 88,46 80,46 C72,46 66,38 66,28 C66,18 72,12 80,12 Z" +
  // Neck
  " M73,44 L73,52 L87,52 L87,44" +
  // Torso
  " M52,52 C52,50 60,48 73,52 L73,52 L87,52 C100,48 108,50 108,52" +
  " L112,60 L116,72 L116,80 L112,94 L108,110 L106,130 L104,145" +
  " C100,150 90,152 80,152 C70,152 60,150 56,145" +
  " L54,130 L52,110 L48,94 L44,80 L44,72 L48,60 Z" +
  // Left arm
  " M44,60 L36,56 L28,60 L20,76 L16,92 L14,108 L16,124 L20,136 L18,148 L14,160" +
  " L16,162 L22,152 L24,140 L22,128 L20,116 L22,104 L26,88 L32,72 L38,62" +
  // Right arm
  " M116,60 L124,56 L132,60 L140,76 L144,92 L146,108 L144,124 L140,136 L142,148 L146,160" +
  " L144,162 L138,152 L136,140 L138,128 L140,116 L138,104 L134,88 L128,72 L122,62" +
  // Left leg
  " M62,150 L58,170 L54,190 L52,210 L50,230 L48,250 L46,270 L44,290 L42,310 L40,326 L38,334" +
  " L44,336 L48,330 L50,316 L52,296 L54,276 L56,256 L58,236 L62,216 L66,196 L70,176 L74,158" +
  // Right leg
  " M98,150 L102,170 L106,190 L108,210 L110,230 L112,250 L114,270 L116,290 L118,310 L120,326 L122,334" +
  " L116,336 L112,330 L110,316 L108,296 L106,276 L104,256 L102,236 L98,216 L94,196 L90,176 L86,158";

const FRONT_MUSCLES: Record<string, string> = {
  deltoids_L:
    "M52,54 C48,52 40,54 36,58 L32,66 L36,72 L44,68 L48,60 Z",
  deltoids_R:
    "M108,54 C112,52 120,54 124,58 L128,66 L124,72 L116,68 L112,60 Z",
  chest_L:
    "M48,64 L44,72 L44,80 L48,90 L54,96 L64,98 L72,96 L76,90 L76,72 L74,66 L72,62 C66,60 56,60 48,64 Z",
  chest_R:
    "M112,64 L116,72 L116,80 L112,90 L106,96 L96,98 L88,96 L84,90 L84,72 L86,66 L88,62 C94,60 104,60 112,64 Z",
  biceps_L:
    "M34,72 L28,68 L24,76 L20,88 L22,100 L26,96 L30,84 L36,76 Z",
  biceps_R:
    "M126,72 L132,68 L136,76 L140,88 L138,100 L134,96 L130,84 L124,76 Z",
  forearms_L:
    "M22,100 L18,110 L16,122 L18,134 L22,130 L24,118 L26,106 L26,98 Z",
  forearms_R:
    "M138,100 L142,110 L144,122 L142,134 L138,130 L136,118 L134,106 L134,98 Z",
  core:
    "M70,98 L68,108 L66,120 L66,134 L68,144 L72,148 L80,150 L88,148 L92,144 L94,134 L94,120 L92,108 L90,98 L84,96 L80,95 L76,96 Z",
  obliques_L:
    "M56,96 L52,110 L54,130 L56,144 L62,148 L68,148 L68,134 L66,118 L66,108 L68,98 L64,96 Z",
  obliques_R:
    "M104,96 L108,110 L106,130 L104,144 L98,148 L92,148 L92,134 L94,118 L94,108 L92,98 L96,96 Z",
  hip_flexors_L:
    "M62,148 L58,158 L56,168 L60,172 L66,166 L70,156 L72,148 Z",
  hip_flexors_R:
    "M98,148 L102,158 L104,168 L100,172 L94,166 L90,156 L88,148 Z",
  quadriceps_L:
    "M56,168 L52,188 L50,208 L48,228 L48,248 L50,256 L56,258 L62,256 L66,248 L68,228 L70,208 L70,188 L68,170 L64,166 Z",
  quadriceps_R:
    "M104,168 L108,188 L110,208 L112,228 L112,248 L110,256 L104,258 L98,256 L94,248 L92,228 L90,208 L90,188 L92,170 L96,166 Z",
  adductors_L:
    "M68,170 L72,186 L74,206 L74,226 L72,240 L68,244 L66,248 L66,228 L68,208 L70,188 Z",
  adductors_R:
    "M92,170 L88,186 L86,206 L86,226 L88,240 L92,244 L94,248 L94,228 L92,208 L90,188 Z",
  calves_L:
    "M48,260 L46,276 L44,296 L44,310 L46,318 L52,320 L56,314 L56,300 L56,280 L54,264 Z",
  calves_R:
    "M112,260 L114,276 L116,296 L116,310 L114,318 L108,320 L104,314 L104,300 L104,280 L106,264 Z",
  abductors_L:
    "M56,148 L50,158 L48,170 L50,180 L54,182 L58,174 L60,162 L62,150 Z",
  abductors_R:
    "M104,148 L110,158 L112,170 L110,180 L106,182 L102,174 L100,162 L98,150 Z",
};

// ── BACK VIEW ───────────────────────────────────────

const BACK_MUSCLES: Record<string, string> = {
  deltoids_L:
    "M52,54 C48,52 40,54 36,58 L32,66 L36,72 L44,68 L48,60 Z",
  deltoids_R:
    "M108,54 C112,52 120,54 124,58 L128,66 L124,72 L116,68 L112,60 Z",
  rotator_cuff_L:
    "M50,62 L44,68 L42,78 L46,82 L52,76 L54,68 Z",
  rotator_cuff_R:
    "M110,62 L116,68 L118,78 L114,82 L108,76 L106,68 Z",
  scapular_L:
    "M56,64 L52,76 L54,92 L62,96 L68,90 L70,76 L68,66 Z",
  scapular_R:
    "M104,64 L108,76 L106,92 L98,96 L92,90 L90,76 L92,66 Z",
  upper_back:
    "M68,62 L66,72 L68,86 L72,92 L80,94 L88,92 L92,86 L94,72 L92,62 L88,58 L80,56 L72,58 Z",
  lats_L:
    "M52,80 L48,90 L50,108 L54,126 L60,136 L66,132 L68,116 L68,100 L66,90 L62,82 Z",
  lats_R:
    "M108,80 L112,90 L110,108 L106,126 L100,136 L94,132 L92,116 L92,100 L94,90 L98,82 Z",
  triceps_L:
    "M34,72 L28,68 L24,76 L20,88 L22,102 L28,98 L32,86 L36,76 Z",
  triceps_R:
    "M126,72 L132,68 L136,76 L140,88 L138,102 L132,98 L128,86 L124,76 Z",
  forearms_L:
    "M22,102 L18,112 L16,124 L18,136 L22,132 L24,120 L26,108 Z",
  forearms_R:
    "M138,102 L142,112 L144,124 L142,136 L138,132 L136,120 L134,108 Z",
  erectors_L:
    "M68,92 L66,106 L66,124 L68,140 L74,146 L78,142 L76,124 L76,106 L74,94 Z",
  erectors_R:
    "M92,92 L94,106 L94,124 L92,140 L86,146 L82,142 L84,124 L84,106 L86,94 Z",
  glutes_L:
    "M56,142 L52,150 L50,162 L52,174 L58,178 L66,176 L72,168 L74,156 L74,146 L68,142 Z",
  glutes_R:
    "M104,142 L108,150 L110,162 L108,174 L102,178 L94,176 L88,168 L86,156 L86,146 L92,142 Z",
  hamstrings_L:
    "M52,178 L50,196 L48,216 L48,236 L50,252 L56,256 L62,252 L66,236 L68,216 L68,196 L66,180 L60,176 Z",
  hamstrings_R:
    "M108,178 L110,196 L112,216 L112,236 L110,252 L104,256 L98,252 L94,236 L92,216 L92,196 L94,180 L100,176 Z",
  calves_L:
    "M48,258 L46,274 L44,294 L44,308 L48,318 L54,320 L58,314 L58,298 L56,278 L54,262 Z",
  calves_R:
    "M112,258 L114,274 L116,294 L116,308 L112,318 L106,320 L102,314 L102,298 L104,278 L106,262 Z",
};

const FRONT_MUSCLE_MAP: Record<MuscleGroup, string[]> = {
  deltoids: ["deltoids_L", "deltoids_R"],
  shoulders: ["deltoids_L", "deltoids_R"],
  chest: ["chest_L", "chest_R"],
  biceps: ["biceps_L", "biceps_R"],
  forearms: ["forearms_L", "forearms_R"],
  core: ["core"],
  obliques: ["obliques_L", "obliques_R"],
  hip_flexors: ["hip_flexors_L", "hip_flexors_R"],
  quadriceps: ["quadriceps_L", "quadriceps_R"],
  adductors: ["adductors_L", "adductors_R"],
  abductors: ["abductors_L", "abductors_R"],
  calves: ["calves_L", "calves_R"],
  hamstrings: [], glutes: [], upper_back: [], lats: [],
  triceps: [], rotator_cuff: [], scapular: [], erectors: [],
};

const BACK_MUSCLE_MAP: Record<MuscleGroup, string[]> = {
  deltoids: ["deltoids_L", "deltoids_R"],
  shoulders: ["deltoids_L", "deltoids_R"],
  rotator_cuff: ["rotator_cuff_L", "rotator_cuff_R"],
  scapular: ["scapular_L", "scapular_R"],
  upper_back: ["upper_back"],
  lats: ["lats_L", "lats_R"],
  triceps: ["triceps_L", "triceps_R"],
  forearms: ["forearms_L", "forearms_R"],
  erectors: ["erectors_L", "erectors_R"],
  glutes: ["glutes_L", "glutes_R"],
  hamstrings: ["hamstrings_L", "hamstrings_R"],
  calves: ["calves_L", "calves_R"],
  chest: [], biceps: [], core: [], obliques: [],
  hip_flexors: [], quadriceps: [], adductors: [], abductors: [],
};

function getActiveKeys(
  muscleMap: Record<MuscleGroup, string[]>,
  primary: MuscleGroup[],
  secondary: MuscleGroup[],
): { primaryKeys: Set<string>; secondaryKeys: Set<string> } {
  const primaryKeys = new Set<string>();
  const secondaryKeys = new Set<string>();
  for (const m of primary) {
    for (const k of muscleMap[m] || []) primaryKeys.add(k);
  }
  for (const m of secondary) {
    for (const k of muscleMap[m] || []) {
      if (!primaryKeys.has(k)) secondaryKeys.add(k);
    }
  }
  return { primaryKeys, secondaryKeys };
}

function BodyView({
  musclePaths,
  muscleMap,
  primary,
  secondary,
  size,
  label,
  id,
}: {
  musclePaths: Record<string, string>;
  muscleMap: Record<MuscleGroup, string[]>;
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
  size: number;
  label: string;
  id: string;
}) {
  const { colors } = useTheme();
  const { primaryKeys, secondaryKeys } = getActiveKeys(muscleMap, primary, secondary);
  const w = size;
  const h = size * (340 / 160);

  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={w} height={h} viewBox="0 0 160 340">
        <Defs>
          <LinearGradient id={`${id}-skin`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.surfaceTertiary} />
            <Stop offset="1" stopColor={colors.surfaceSecondary} />
          </LinearGradient>
          <LinearGradient id={`${id}-primary`} x1="0" y1="0" x2="0.3" y2="1">
            <Stop offset="0" stopColor="#B8E85A" />
            <Stop offset="0.5" stopColor="#A0D932" />
            <Stop offset="1" stopColor="#6B9A1E" />
          </LinearGradient>
          <LinearGradient id={`${id}-secondary`} x1="0" y1="0" x2="0.3" y2="1">
            <Stop offset="0" stopColor="#6B9A1E" />
            <Stop offset="0.5" stopColor="#4D7016" />
            <Stop offset="1" stopColor="#3A5410" />
          </LinearGradient>
          <LinearGradient id={`${id}-inactive`} x1="0" y1="0" x2="0.2" y2="1">
            <Stop offset="0" stopColor={colors.surfaceTertiary} />
            <Stop offset="1" stopColor={colors.surfaceSecondary} />
          </LinearGradient>
        </Defs>

        {/* Body silhouette */}
        <Path
          d={BODY_FRONT_OUTLINE}
          fill={`url(#${id}-skin)`}
          stroke={colors.border}
          strokeWidth={1}
          strokeLinejoin="round"
          opacity={0.6}
        />

        {/* Muscle groups */}
        {Object.entries(musclePaths).map(([key, path]) => {
          const isPrimary = primaryKeys.has(key);
          const isSecondary = secondaryKeys.has(key);
          let fill = `url(#${id}-inactive)`;
          let stroke = colors.border;
          let opacity = 0.5;

          if (isPrimary) {
            fill = `url(#${id}-primary)`;
            stroke = colors.brandPrimary;
            opacity = 1;
          } else if (isSecondary) {
            fill = `url(#${id}-secondary)`;
            stroke = "#6B9A1E";
            opacity = 0.85;
          }

          return (
            <Path
              key={key}
              d={path}
              fill={fill}
              stroke={stroke}
              strokeWidth={0.8}
              strokeLinejoin="round"
              opacity={opacity}
            />
          );
        })}
      </Svg>
      <Text style={[s.viewLabel, { color: colors.onSurfaceSecondary }]}>{label}</Text>
    </View>
  );
}

export default function MuscleMap({ primary, secondary, size = 80 }: Props) {
  const hasFront = primary.some((m) => (FRONT_MUSCLE_MAP[m]?.length || 0) > 0) ||
                   secondary.some((m) => (FRONT_MUSCLE_MAP[m]?.length || 0) > 0);
  const hasBack = primary.some((m) => (BACK_MUSCLE_MAP[m]?.length || 0) > 0) ||
                  secondary.some((m) => (BACK_MUSCLE_MAP[m]?.length || 0) > 0);

  if (!hasFront && !hasBack) return null;

  return (
    <View style={s.container}>
      {hasFront && (
        <BodyView
          musclePaths={FRONT_MUSCLES}
          muscleMap={FRONT_MUSCLE_MAP}
          primary={primary}
          secondary={secondary}
          size={size}
          label="Frontal"
          id="front"
        />
      )}
      {hasBack && (
        <BodyView
          musclePaths={BACK_MUSCLES}
          muscleMap={BACK_MUSCLE_MAP}
          primary={primary}
          secondary={secondary}
          size={size}
          label="Posterior"
          id="back"
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xl,
    paddingVertical: spacing.sm,
  },
  viewLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    marginTop: spacing.xs,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
});
