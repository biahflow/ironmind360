import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { themes, type ThemeMode } from "@/src/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_KEY = "ironmind_theme";

type ThemeState = {
  mode: ThemeMode;
  colors: typeof themes.dark;
  toggle: () => void;
  setMode: (m: ThemeMode) => void;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeState>({
  mode: "dark",
  colors: themes.dark,
  toggle: () => {},
  setMode: () => {},
  isDark: true,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved === "light" || saved === "dark") {
        setModeState(saved);
      }
      setReady(true);
    });
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(THEME_KEY, m);
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === "dark" ? "light" : "dark");
  }, [mode, setMode]);

  if (!ready) return null;

  return (
    <ThemeContext.Provider
      value={{
        mode,
        colors: themes[mode],
        toggle,
        setMode,
        isDark: mode === "dark",
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
