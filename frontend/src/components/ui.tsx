import React from "react";
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
  ViewStyle, StyleProp, TextStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { spacing, radius, fonts, type } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";

/**
 * Shared design-system primitives, aligned with the Home screen.
 *
 * Design language:
 *  - Root background: colors.bg (near-black in dark)
 *  - Cards: colors.surface + 1px colors.border, no shadows/glow
 *  - Typography: DMSans (fonts.text/medium/semibold/bold) with the `type` scale
 *  - Accent (lime) used sparingly for primary actions and highlights
 */

// ── Screen root ──────────────────────────────────────────────
export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[st.screen, { backgroundColor: colors.bg }, style]}>{children}</View>;
}

// ── Circular icon button (header / nav) ──────────────────────
export function IconButton({
  icon, onPress, testID, color, size = 18, disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  testID?: string;
  color?: string;
  size?: number;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        st.iconBtn,
        { borderColor: colors.border },
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

// ── Section title ────────────────────────────────────────────
export function SectionTitle({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return <Text style={[st.sectionTitle, { color: colors.text }, style]}>{children}</Text>;
}

// ── Overline / kicker (uppercase caption) ────────────────────
export function Overline({ children, color, style }: { children: React.ReactNode; color?: string; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return <Text style={[st.overline, { color: color || colors.textSecondary }, style]}>{children}</Text>;
}

// ── Primary button (accent fill, no glow) ────────────────────
export function PrimaryButton({
  label, onPress, loading, disabled, icon, testID, style,
}: {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        st.primaryBtn,
        { backgroundColor: colors.accent },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onAccent} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={colors.onAccent} /> : null}
          <Text style={[st.primaryBtnText, { color: colors.onAccent }]}>{label}</Text>
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
  icon?: keyof typeof Ionicons.glyphMap;
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

// ── Pill tabs (segmented) ────────────────────────────────────
export function PillTabs<T extends string>({
  tabs, value, onChange, style,
}: {
  tabs: { key: T; label: string; icon?: keyof typeof Ionicons.glyphMap }[];
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

// ── Empty state ──────────────────────────────────────────────
export function EmptyState({
  icon, title, text, action,
}: {
  icon: keyof typeof Ionicons.glyphMap;
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

// ── Shared layout constants ──────────────────────────────────
export const layout = {
  screenPad: spacing["2xl"],
  tabBarPad: (bottom: number) => 64 + bottom + spacing.lg,
};

const st = StyleSheet.create({
  screen: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing["2xl"],
    paddingBottom: spacing.xl,
  },
  headerText: { flex: 1 },
  headerTitle: { fontFamily: fonts.bold, ...type.h1 },
  headerSubtitle: { fontFamily: fonts.text, ...type.bodySmall, marginTop: 2 },
  headerRight: { marginLeft: spacing.md },

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  card: {
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
  },
  cardLarge: {
    borderRadius: radius.xl,
    padding: spacing["2xl"],
    borderWidth: 1,
  },

  sectionTitle: { fontFamily: fonts.bold, ...type.h2, marginBottom: spacing.lg },
  overline: {
    fontFamily: fonts.semibold,
    ...type.caption,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },

  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 56,
    borderRadius: radius.pill,
  },
  primaryBtnText: { fontFamily: fonts.bold, ...type.body },

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

  pillRow: { flexDirection: "row", gap: spacing.sm },
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
