import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { themes, type ResolvedScheme, type ThemeMode } from "@/src/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_KEY = "ironmind_theme";

type ThemeState = {
  mode: ThemeMode; // preferência do usuário: dark | light | system
  scheme: ResolvedScheme; // esquema efetivamente aplicado
  colors: typeof themes.dark;
  toggle: () => void;
  setMode: (m: ThemeMode) => void;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeState>({
  mode: "dark",
  scheme: "dark",
  colors: themes.dark,
  toggle: () => {},
  setMode: () => {},
  isDark: true,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme(); // "light" | "dark" | null (segue o SO)
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved === "light" || saved === "dark" || saved === "system") {
        setModeState(saved);
      }
      setReady(true);
    });
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(THEME_KEY, m);
  }, []);

  // Modo "system" resolve para o esquema do SO (fallback: dark).
  const scheme: ResolvedScheme =
    mode === "system" ? (systemScheme === "light" ? "light" : "dark") : mode;

  const toggle = useCallback(() => {
    // Alterna apenas entre claro/escuro explícitos (sai do modo automático).
    setMode(scheme === "dark" ? "light" : "dark");
  }, [scheme, setMode]);

  if (!ready) return null;

  return (
    <ThemeContext.Provider
      value={{
        mode,
        scheme,
        colors: themes[scheme],
        toggle,
        setMode,
        isDark: scheme === "dark",
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
