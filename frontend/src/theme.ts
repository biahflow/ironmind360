export const palette = {
  accent: "#A8E51C",
  accentMuted: "rgba(168,229,28,0.12)",
  onAccent: "#151515",

  black: "#101011",
  surface: "#18181A",
  elevated: "#202023",

  textPrimary: "#F5F5F3",
  textSecondary: "#A4A4A0",
  borderDark: "rgba(255,255,255,0.08)",

  lightBg: "#F7F7F4",
  lightSurface: "#FFFFFF",
  lightText: "#151515",
  lightTextSecondary: "#72726E",
  lightBorder: "rgba(0,0,0,0.06)",

  success: "#2ECC71",
  warning: "#F5A623",
  error: "#E74C3C",
  info: "#3498DB",

  // Semantic translucent surfaces (dark) — replaces ad-hoc rgba(...) in screens
  successMuted: "rgba(46,204,113,0.14)",
  warningMuted: "rgba(245,166,35,0.16)",
  errorMuted: "rgba(231,76,60,0.14)",
  infoMuted: "rgba(52,152,219,0.14)",

  // Data-viz palette (macros / segmented charts) — tokenized, no hardcoded hex in screens
  macroProtein: "#4ECDC4",
  macroCarbs: "#F5C542",
  macroFat: "#F08A6B",
};

export type ThemeMode = "dark" | "light";

type ColorScheme = {
  bg: string;
  surface: string;
  elevated: string;
  text: string;
  textSecondary: string;
  border: string;
  accent: string;
  accentMuted: string;
  onAccent: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  successMuted: string;
  warningMuted: string;
  errorMuted: string;
  infoMuted: string;
  macroProtein: string;
  macroCarbs: string;
  macroFat: string;
  overlay: string;
  tabBar: string;
  tabBarBorder: string;
  // compat aliases used by other screens
  surfaceSecondary: string;
  surfaceTertiary: string;
  surfaceElevated: string;
  onSurface: string;
  onSurfaceSecondary: string;
  onSurfaceTertiary: string;
  surfaceInverse: string;
  onSurfaceInverse: string;
  brand: string;
  brandPrimary: string;
  onBrandPrimary: string;
  brandSecondary: string;
  brandTertiary: string;
  onBrandTertiary: string;
  onSuccess: string;
  onWarning: string;
  onError: string;
  borderStrong: string;
  divider: string;
  skeleton: string;
  inputBackground: string;
  cardBackground: string;
};

const darkColors: ColorScheme = {
  bg: palette.black,
  surface: palette.surface,
  elevated: palette.elevated,
  text: palette.textPrimary,
  textSecondary: palette.textSecondary,
  border: palette.borderDark,
  accent: palette.accent,
  accentMuted: palette.accentMuted,
  onAccent: palette.onAccent,
  success: palette.success,
  warning: palette.warning,
  error: palette.error,
  info: palette.info,
  successMuted: palette.successMuted,
  warningMuted: palette.warningMuted,
  errorMuted: palette.errorMuted,
  infoMuted: palette.infoMuted,
  macroProtein: palette.macroProtein,
  macroCarbs: palette.macroCarbs,
  macroFat: palette.macroFat,
  overlay: "rgba(0,0,0,0.6)",
  tabBar: palette.surface,
  tabBarBorder: palette.borderDark,
  // compat
  surfaceSecondary: palette.surface,
  surfaceTertiary: palette.elevated,
  surfaceElevated: palette.elevated,
  onSurface: palette.textPrimary,
  onSurfaceSecondary: palette.textSecondary,
  onSurfaceTertiary: palette.textSecondary,
  surfaceInverse: palette.lightSurface,
  onSurfaceInverse: palette.black,
  brand: palette.accent,
  brandPrimary: palette.accent,
  onBrandPrimary: palette.onAccent,
  brandSecondary: palette.accent,
  brandTertiary: palette.accentMuted,
  onBrandTertiary: palette.accent,
  onSuccess: "#FFFFFF",
  onWarning: palette.onAccent,
  onError: "#FFFFFF",
  borderStrong: palette.elevated,
  divider: palette.borderDark,
  skeleton: palette.elevated,
  inputBackground: palette.surface,
  cardBackground: palette.surface,
};

const lightColors: ColorScheme = {
  bg: palette.lightBg,
  surface: palette.lightSurface,
  elevated: palette.lightSurface,
  text: palette.lightText,
  textSecondary: palette.lightTextSecondary,
  border: palette.lightBorder,
  accent: palette.accent,
  accentMuted: "rgba(168,229,28,0.10)",
  onAccent: palette.onAccent,
  success: palette.success,
  warning: palette.warning,
  error: palette.error,
  info: palette.info,
  successMuted: "rgba(46,204,113,0.10)",
  warningMuted: "rgba(245,166,35,0.12)",
  errorMuted: "rgba(231,76,60,0.10)",
  infoMuted: "rgba(52,152,219,0.10)",
  macroProtein: palette.macroProtein,
  macroCarbs: palette.macroCarbs,
  macroFat: palette.macroFat,
  overlay: "rgba(0,0,0,0.4)",
  tabBar: palette.lightSurface,
  tabBarBorder: palette.lightBorder,
  // compat
  surfaceSecondary: palette.lightBg,
  surfaceTertiary: "#EDEDEA",
  surfaceElevated: palette.lightSurface,
  onSurface: palette.lightText,
  onSurfaceSecondary: palette.lightTextSecondary,
  onSurfaceTertiary: palette.lightTextSecondary,
  surfaceInverse: palette.black,
  onSurfaceInverse: palette.lightSurface,
  brand: palette.accent,
  brandPrimary: palette.accent,
  onBrandPrimary: palette.onAccent,
  brandSecondary: "#8BC42A",
  brandTertiary: "rgba(168,229,28,0.10)",
  onBrandTertiary: "#8BC42A",
  onSuccess: "#FFFFFF",
  onWarning: palette.onAccent,
  onError: "#FFFFFF",
  borderStrong: "#D5D5D0",
  divider: palette.lightBorder,
  skeleton: "#E5E5E2",
  inputBackground: palette.lightBg,
  cardBackground: palette.lightSurface,
};

export const themes = { dark: darkColors, light: lightColors } as const;

export const colors = darkColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  // Golden-reference (Home) card radii
  card: 20,
  cardLarge: 24,
  hero: 28,
  pill: 999,
};

// Single source of truth for form control height (kills the 44/48/56 drift)
export const controlHeight = 56;

export const shadow = {
  sm: {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  lg: {
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  }),
} as const;

export const fonts = {
  display: "BebasNeue",
  text: "DMSans",
  medium: "DMSans-Medium",
  semibold: "DMSans-SemiBold",
  bold: "DMSans-Bold",
  mono: "SpaceMono",
};

export const type = {
  caption: { fontSize: 11, lineHeight: 14 },
  bodySmall: { fontSize: 13, lineHeight: 18 },
  body: { fontSize: 15, lineHeight: 22 },
  h2: { fontSize: 20, lineHeight: 26 },
  metric: { fontSize: 24, lineHeight: 28 },
  h1: { fontSize: 28, lineHeight: 32 },
  display: { fontSize: 32, lineHeight: 36 },
  // raw sizes for backward compat
  xs: 11,
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 48,
  "5xl": 72,
};
