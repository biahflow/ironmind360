// IronMind 360 — Eva-inspired design tokens with light/dark theming

export const palette = {
  primary: "#A0D932",
  primaryDark: "#8BC42A",
  primaryLight: "#B8E85A",
  onPrimary: "#1A1A1A",

  black: "#0A0A0A",
  grey950: "#111113",
  grey900: "#1A1B1F",
  grey800: "#252630",
  grey700: "#35374A",
  grey600: "#52556E",
  grey500: "#71748F",
  grey400: "#9496AD",
  grey300: "#B8BACE",
  grey200: "#D5D7E3",
  grey100: "#E9EAF0",
  grey50: "#F4F5F8",
  white: "#FFFFFF",

  success: "#2ECC71",
  warning: "#F5A623",
  error: "#E74C3C",
  info: "#3498DB",
};

export type ThemeMode = "dark" | "light";

type ColorScheme = {
  surface: string;
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
  success: string;
  onSuccess: string;
  warning: string;
  onWarning: string;
  error: string;
  onError: string;
  info: string;
  border: string;
  borderStrong: string;
  divider: string;
  skeleton: string;
  overlay: string;
  tabBar: string;
  tabBarBorder: string;
  inputBackground: string;
  cardBackground: string;
};

const darkColors: ColorScheme = {
  surface: palette.black,
  surfaceSecondary: palette.grey950,
  surfaceTertiary: palette.grey900,
  surfaceElevated: palette.grey800,
  onSurface: palette.white,
  onSurfaceSecondary: palette.grey400,
  onSurfaceTertiary: palette.grey300,
  surfaceInverse: palette.white,
  onSurfaceInverse: palette.black,
  brand: palette.primary,
  brandPrimary: palette.primary,
  onBrandPrimary: palette.black,
  brandSecondary: palette.primaryLight,
  brandTertiary: "rgba(160,217,50,0.12)",
  onBrandTertiary: palette.primary,
  success: palette.success,
  onSuccess: palette.white,
  warning: palette.warning,
  onWarning: palette.black,
  error: palette.error,
  onError: palette.white,
  info: palette.info,
  border: palette.grey800,
  borderStrong: palette.grey700,
  divider: palette.grey900,
  skeleton: palette.grey800,
  overlay: "rgba(0,0,0,0.6)",
  tabBar: palette.grey950,
  tabBarBorder: palette.grey800,
  inputBackground: palette.grey900,
  cardBackground: palette.grey950,
};

const lightColors: ColorScheme = {
  surface: palette.white,
  surfaceSecondary: palette.grey50,
  surfaceTertiary: palette.grey100,
  surfaceElevated: palette.white,
  onSurface: palette.grey950,
  onSurfaceSecondary: palette.grey600,
  onSurfaceTertiary: palette.grey500,
  surfaceInverse: palette.black,
  onSurfaceInverse: palette.white,
  brand: palette.primary,
  brandPrimary: palette.primary,
  onBrandPrimary: palette.black,
  brandSecondary: palette.primaryDark,
  brandTertiary: "rgba(160,217,50,0.10)",
  onBrandTertiary: palette.primaryDark,
  success: palette.success,
  onSuccess: palette.white,
  warning: palette.warning,
  onWarning: palette.black,
  error: palette.error,
  onError: palette.white,
  info: palette.info,
  border: palette.grey200,
  borderStrong: palette.grey300,
  divider: palette.grey100,
  skeleton: palette.grey200,
  overlay: "rgba(0,0,0,0.4)",
  tabBar: palette.white,
  tabBarBorder: palette.grey200,
  inputBackground: palette.grey100,
  cardBackground: palette.white,
};

export const themes = { dark: darkColors, light: lightColors } as const;

// Default export for backwards compatibility — screens that haven't migrated
// to useTheme() yet import { colors } directly and get the dark palette.
export const colors = darkColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
};

export const radius = {
  sm: 8,
  md: 16,
  lg: 20,
  xl: 28,
  pill: 999,
};

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
