import React from "react";
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput,
  ViewStyle, StyleProp, TextStyle, TextInputProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { spacing, radius, fonts, type, controlHeight } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";

/**
 * Shared design-system primitives — the single source of truth for the
 * IronMind 360 visual language, extracted from the approved Home screen.
 *
 * Design language (golden reference = app/(tabs)/index.tsx):
 *  - Root background: colors.bg (near-black in dark)
 *  - Surfaces: bg → surface (cards) → elevated (chips inside cards)
 *  - Cards: colors.surface + 1px colors.border, radius 20–24, no shadows/glow
 *  - Typography: DMSans (fonts.text/medium/semibold/bold) with the `type` scale;
 *    big numbers use fonts.bold + tabular-nums (never BebasNeue)
 *  - Accent (lime) is a highlight, not a background — primary actions, active
 *    states, progress, current selection, positive attention only
 *  - Iconography: Ionicons outline by default, filled only for active states
 */

type IconName = keyof typeof Ionicons.glyphMap;
type Tone = "accent" | "neutral" | "success" | "warning" | "error" | "info";

// ── Screen root ──────────────────────────────────────────────
export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[st.screen, { backgroundColor: colors.bg }, style]}>{children}</View>;
}

// ── Circular icon button (header / nav) ──────────────────────
export function IconButton({
  icon, onPress, testID, color, size = 18, disabled, label,
}: {
  icon: IconName;
  onPress?: () => void;
  testID?: string;
  color?: string;
  size?: number;
  disabled?: boolean;
  label?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label || (icon === "chevron-back" ? "Voltar" : icon)}
      style={({ pressed }) => [
        st.iconBtn,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Ionicons name={icon} size={size} color={color || colors.textSecondary} />
    </Pressable>
  );
}

// ── Screen header (left-aligned title, optional back + right slot) ──
export function ScreenHeader({
  title, subtitle, onBack, right, center,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  center?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[st.header, { paddingTop: insets.top + spacing.md }]}>
      {onBack ? <IconButton icon="chevron-back" onPress={onBack} size={20} color={colors.text} /> : null}
      <View style={[st.headerText, center && { alignItems: "center" }, onBack && { marginLeft: spacing.md }]}>
        <Text style={[st.headerTitle, { color: colors.text }]} numberOfLines={1}>{title}</Text>
        {subtitle ? (
          <Text style={[st.headerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>
      {right ? <View style={st.headerRight}>{right}</View> : null}
    </View>
  );
}

// ── Card (bordered surface) ──────────────────────────────────
export function Card({
  children, style, onPress, testID, large,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  testID?: string;
  large?: boolean;
}) {
  const { colors } = useTheme();
  const base = [
    large ? st.cardLarge : st.card,
    { backgroundColor: colors.surface, borderColor: colors.border },
    style,
  ];
  if (onPress) {
    return (
      <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.85 }]}>
        {children}
      </Pressable>
    );
  }
  return <View testID={testID} style={base}>{children}</View>;
}

// ── Hero card (subtle surface→elevated gradient) ─────────────
// The only place a gradient is allowed: same-family diagonal, never decorative.
export function HeroCard({
  children, style, reverse,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  reverse?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <LinearGradient
      colors={reverse ? [colors.elevated, colors.surface] : [colors.surface, colors.elevated]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[st.hero, { borderColor: colors.border }, style]}
    >
      {children}
    </LinearGradient>
  );
}

// ── Section title ────────────────────────────────────────────
export function SectionTitle({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return <Text style={[st.sectionTitle, { color: colors.text }, style]}>{children}</Text>;
}

// ── Section header (title + optional action link) ────────────
export function SectionHeader({
  title, action, onAction, first, style,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  first?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View style={[st.sectionHeader, first && { marginTop: spacing.sm }, style]}>
      <Text style={[st.sectionHeaderTitle, { color: colors.text }]}>{title}</Text>
      {action ? (
        <Text
          onPress={onAction}
          suppressHighlighting
          style={[st.sectionAction, { color: colors.accent }]}
        >
          {action}
        </Text>
      ) : null}
    </View>
  );
}

// ── Overline / kicker (uppercase caption) ────────────────────
export function Overline({ children, color, style }: { children: React.ReactNode; color?: string; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return <Text style={[st.overline, { color: color || colors.textSecondary }, style]}>{children}</Text>;
}

// ── Thin progress bar (track + accent fill) ──────────────────
export function ProgressBar({
  progress, color, trackColor, style,
}: {
  progress: number;
  color?: string;
  trackColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <View style={[st.progressTrack, { backgroundColor: trackColor || colors.border }, style]}>
      <View style={[st.progressFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: color || colors.accent }]} />
    </View>
  );
}

// ── Metric card (icon chip + label + value + sub + progress) ─
export function MetricCard({
  icon, label, value, sub, progress, onPress, testID, tone = "accent", iconColor: iconColorProp,
}: {
  icon: IconName;
  label: string;
  value: string;
  sub?: string;
  progress?: number;
  onPress?: () => void;
  testID?: string;
  tone?: "accent" | "neutral";
  iconColor?: string;
}) {
  const { colors } = useTheme();
  const iconColor = iconColorProp || (tone === "accent" ? colors.accent : colors.textSecondary);
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        st.metricCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && onPress ? { opacity: 0.85 } : null,
      ]}
    >
      <View style={[st.metricIcon, { backgroundColor: colors.elevated }]}>
        <Ionicons name={icon} size={19} color={iconColor} />
      </View>
      <Text style={[st.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[st.metricValue, { color: colors.text }]}>{value}</Text>
      {sub ? <Text style={[st.metricSub, { color: colors.textSecondary }]}>{sub}</Text> : null}
      {progress != null ? <ProgressBar progress={progress} color={iconColorProp} style={{ marginTop: "auto" }} /> : null}
    </Pressable>
  );
}

// ── Stat tile (icon header + label + value + supporting copy) ─
export function StatTile({
  icon, label, value, supporting, trend, style, iconColor,
}: {
  icon: IconName;
  label: string;
  value: string;
  supporting?: string;
  trend?: IconName;
  style?: StyleProp<ViewStyle>;
  iconColor?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={[st.statTile, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      <View style={st.statHeader}>
        <View style={[st.statIcon, { backgroundColor: colors.elevated }]}>
          <Ionicons name={icon} size={18} color={iconColor || colors.textSecondary} />
        </View>
        {trend ? <Ionicons name={trend} size={16} color={colors.accent} /> : null}
      </View>
      <Text style={[st.statLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[st.statValue, { color: colors.text }]}>{value}</Text>
      {supporting ? (
        <Text style={[st.statSupporting, { color: colors.textSecondary }]} numberOfLines={2}>{supporting}</Text>
      ) : null}
    </View>
  );
}

// ── Chip / badge (tone-driven, token-backed) ─────────────────
function toneColors(colors: ReturnType<typeof useTheme>["colors"], tone: Tone, filled: boolean) {
  if (filled) {
    if (tone === "accent") return { bg: colors.accent, fg: colors.onAccent };
    if (tone === "success") return { bg: colors.success, fg: "#FFFFFF" };
    if (tone === "warning") return { bg: colors.warning, fg: colors.onAccent };
    if (tone === "error") return { bg: colors.error, fg: "#FFFFFF" };
    if (tone === "info") return { bg: colors.info, fg: "#FFFFFF" };
    return { bg: colors.elevated, fg: colors.text };
  }
  switch (tone) {
    case "accent": return { bg: colors.accentMuted, fg: colors.accent };
    case "success": return { bg: colors.successMuted, fg: colors.success };
    case "warning": return { bg: colors.warningMuted, fg: colors.warning };
    case "error": return { bg: colors.errorMuted, fg: colors.error };
    case "info": return { bg: colors.infoMuted, fg: colors.info };
    default: return { bg: colors.elevated, fg: colors.textSecondary };
  }
}

export function Chip({
  label, icon, tone = "neutral", filled, dot, style,
}: {
  label: string;
  icon?: IconName;
  tone?: Tone;
  filled?: boolean;
  dot?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const { bg, fg } = toneColors(colors, tone, Boolean(filled));
  return (
    <View style={[st.chip, { backgroundColor: bg }, style]}>
      {dot ? <View style={[st.chipDot, { backgroundColor: fg }]} /> : null}
      {icon ? <Ionicons name={icon} size={13} color={fg} /> : null}
      <Text style={[st.chipText, { color: fg }]}>{label}</Text>
    </View>
  );
}

// StatusPill = Chip with a leading dot (semantic status label)
export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  return <Chip label={label} tone={tone} dot />;
}

// ── List row (icon chip + title/subtitle + trailing) ─────────
export function ListRow({
  icon, iconTone = "accent", title, subtitle, right, onPress, testID, style,
}: {
  icon?: IconName;
  iconTone?: "accent" | "neutral";
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const iconBg = iconTone === "accent" ? colors.accentMuted : colors.elevated;
  const iconColor = iconTone === "accent" ? colors.accent : colors.textSecondary;
  const content = (
    <>
      {icon ? (
        <View style={[st.rowIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={19} color={iconColor} />
        </View>
      ) : null}
      <View style={st.rowText}>
        <Text style={[st.rowTitle, { color: colors.text }]} numberOfLines={1}>{title}</Text>
        {subtitle ? (
          <Text style={[st.rowSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>
      {right !== undefined ? (
        <View style={st.rowRight}>{right}</View>
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      ) : null}
    </>
  );
  const base = [st.row, { backgroundColor: colors.surface, borderColor: colors.border }, style];
  if (onPress) {
    return (
      <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.85 }]}>
        {content}
      </Pressable>
    );
  }
  return <View testID={testID} style={base}>{content}</View>;
}

// ── Text input / field ───────────────────────────────────────
export function Input({
  icon, label, error, style, containerStyle, ...props
}: TextInputProps & {
  icon?: IconName;
  label?: string;
  error?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View style={containerStyle}>
      {label ? <Text style={[st.inputLabel, { color: colors.textSecondary }]}>{label}</Text> : null}
      <View
        style={[
          st.inputWrap,
          {
            backgroundColor: colors.inputBackground,
            borderColor: error ? colors.error : colors.border,
          },
        ]}
      >
        {icon ? (
          <View style={[st.inputIcon, { backgroundColor: colors.accentMuted }]}>
            <Ionicons name={icon} size={16} color={colors.accent} />
          </View>
        ) : null}
        <TextInput
          placeholderTextColor={colors.textSecondary}
          style={[st.input, { color: colors.text }, style]}
          {...props}
        />
      </View>
    </View>
  );
}

// ── Primary button (accent fill, no glow) ────────────────────
export function PrimaryButton({
  label, onPress, loading, disabled, icon, testID, style, small,
}: {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        st.primaryBtn,
        small && st.primaryBtnSmall,
        { backgroundColor: colors.accent },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onAccent} size={small ? "small" : undefined} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={colors.onAccent} /> : null}
          <Text style={[small ? st.primaryBtnTextSmall : st.primaryBtnText, { color: colors.onAccent }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

// ── Secondary button (bordered) ──────────────────────────────
export function SecondaryButton({
  label, onPress, icon, color, testID, style,
}: {
  label: string;
  onPress?: () => void;
  icon?: IconName;
  color?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const tint = color || colors.textSecondary;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        st.secondaryBtn,
        { borderColor: colors.border, backgroundColor: colors.surface },
        pressed && { opacity: 0.7 },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={16} color={tint} /> : null}
      <Text style={[st.secondaryBtnText, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

// ── Pill tabs / segmented control ────────────────────────────
export function PillTabs<T extends string>({
  tabs, value, onChange, style,
}: {
  tabs: { key: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (key: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View style={[st.pillRow, style]}>
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={[
              st.pillTab,
              {
                backgroundColor: active ? colors.accent : colors.surface,
                borderColor: active ? colors.accent : colors.border,
              },
            ]}
          >
            {t.icon ? (
              <Ionicons name={t.icon} size={16} color={active ? colors.onAccent : colors.textSecondary} />
            ) : null}
            <Text
              style={[
                st.pillTabText,
                { color: active ? colors.onAccent : colors.textSecondary },
              ]}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Alias — same primitive, clearer name where used as a control
export const SegmentedControl = PillTabs;

// ── Loading state ────────────────────────────────────────────
export function LoadingState({ label, full }: { label?: string; full?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[full ? st.loadingFull : st.loading, full && { backgroundColor: colors.bg }]}>
      <ActivityIndicator color={colors.accent} />
      {label ? <Text style={[st.loadingText, { color: colors.textSecondary }]}>{label}</Text> : null}
    </View>
  );
}

// ── Empty state ──────────────────────────────────────────────
export function EmptyState({
  icon, title, text, action,
}: {
  icon: IconName;
  title: string;
  text?: string;
  action?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={st.empty}>
      <View style={[st.emptyIcon, { backgroundColor: colors.elevated }]}>
        <Ionicons name={icon} size={32} color={colors.textSecondary} />
      </View>
      <Text style={[st.emptyTitle, { color: colors.text }]}>{title}</Text>
      {text ? <Text style={[st.emptyText, { color: colors.textSecondary }]}>{text}</Text> : null}
      {action ? <View style={{ marginTop: spacing.xl }}>{action}</View> : null}
    </View>
  );
}

// ── Error state (with retry) ─────────────────────────────────
export function ErrorState({
  title = "Algo deu errado", text = "Não foi possível carregar. Tente novamente.", onRetry,
}: {
  title?: string;
  text?: string;
  onRetry?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={st.empty}>
      <View style={[st.emptyIcon, { backgroundColor: colors.elevated }]}>
        <Ionicons name="cloud-offline-outline" size={32} color={colors.textSecondary} />
      </View>
      <Text style={[st.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[st.emptyText, { color: colors.textSecondary }]}>{text}</Text>
      {onRetry ? (
        <View style={{ marginTop: spacing.xl }}>
          <PrimaryButton label="Tentar de novo" icon="refresh" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

// ── Shared layout constants ──────────────────────────────────
export const layout = {
  screenPad: spacing.xl,
  tabBarPad: (bottom: number) => 92 + bottom,
};

const st = StyleSheet.create({
  screen: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  headerText: { flex: 1 },
  headerTitle: { fontFamily: fonts.bold, ...type.h1 },
  headerSubtitle: { fontFamily: fonts.text, ...type.bodySmall, marginTop: 2 },
  headerRight: { marginLeft: spacing.md },

  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  card: {
    borderRadius: radius.card,
    padding: spacing.xl,
    borderWidth: 1,
  },
  cardLarge: {
    borderRadius: radius.cardLarge,
    padding: spacing["2xl"],
    borderWidth: 1,
  },

  hero: {
    borderRadius: radius.hero,
    borderWidth: 1,
    padding: spacing.xl,
    overflow: "hidden",
  },

  sectionTitle: { fontFamily: fonts.bold, ...type.h2, marginBottom: spacing.lg },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing["3xl"],
    marginBottom: spacing.md,
  },
  sectionHeaderTitle: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 25 },
  sectionAction: { fontFamily: fonts.semibold, ...type.bodySmall },

  overline: {
    fontFamily: fonts.semibold,
    ...type.caption,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },

  progressTrack: {
    height: 4,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  progressFill: { height: 4, borderRadius: radius.pill },

  metricCard: {
    flex: 1,
    minHeight: 156,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.md,
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  metricLabel: { fontFamily: fonts.medium, ...type.caption },
  metricValue: {
    fontFamily: fonts.bold,
    fontSize: 23,
    lineHeight: 27,
    marginTop: 3,
    fontVariant: ["tabular-nums"],
  },
  metricSub: { fontFamily: fonts.text, fontSize: 10, lineHeight: 14, marginTop: 1 },

  statTile: {
    flex: 1,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    minHeight: 172,
  },
  statHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  statLabel: { fontFamily: fonts.medium, ...type.caption, marginTop: spacing.lg },
  statValue: { fontFamily: fonts.bold, ...type.body, marginTop: spacing.xs },
  statSupporting: { fontFamily: fonts.text, ...type.caption, marginTop: spacing.sm, lineHeight: 16 },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontFamily: fonts.semibold, ...type.caption },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.lg,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1 },
  rowTitle: { fontFamily: fonts.semibold, ...type.body },
  rowSubtitle: { fontFamily: fonts.text, ...type.bodySmall, marginTop: 2 },
  rowRight: { marginLeft: spacing.sm },

  inputLabel: {
    fontFamily: fonts.semibold,
    ...type.caption,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: controlHeight,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  inputIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  input: { flex: 1, fontFamily: fonts.medium, ...type.body },

  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: controlHeight,
    paddingHorizontal: spacing["2xl"],
    borderRadius: radius.pill,
  },
  primaryBtnText: { fontFamily: fonts.bold, ...type.body },
  primaryBtnSmall: {
    height: 44,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  primaryBtnTextSmall: { fontFamily: fonts.bold, ...type.bodySmall },

  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
  },
  secondaryBtnText: { fontFamily: fonts.semibold, ...type.bodySmall },

  pillRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  pillTab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    height: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  pillTabText: { fontFamily: fonts.semibold, ...type.bodySmall },

  loading: { paddingVertical: spacing["4xl"], alignItems: "center", justifyContent: "center", gap: spacing.md },
  loadingFull: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  loadingText: { fontFamily: fonts.medium, ...type.bodySmall },

  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing["2xl"],
    paddingTop: spacing["4xl"],
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  emptyTitle: { fontFamily: fonts.bold, ...type.h2, textAlign: "center" },
  emptyText: {
    fontFamily: fonts.text,
    ...type.body,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 22,
  },
});
