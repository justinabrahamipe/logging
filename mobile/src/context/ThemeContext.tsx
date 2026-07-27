import * as SecureStore from "expo-secure-store";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { darkTheme, lightTheme, Theme } from "../theme";

const THEME_PREF_KEY = "grindconsole.themePreference";

export type ThemePreference = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  useEffect(() => {
    (async () => {
      const stored = await SecureStore.getItemAsync(THEME_PREF_KEY);
      if (stored === "light" || stored === "dark" || stored === "system") {
        setPreferenceState(stored);
      }
    })();
  }, []);

  const setPreference = (pref: ThemePreference) => {
    setPreferenceState(pref);
    SecureStore.setItemAsync(THEME_PREF_KEY, pref).catch(() => {});
  };

  const isDark = preference === "system" ? scheme === "dark" : preference === "dark";
  const theme = isDark ? darkTheme : lightTheme;

  const value = useMemo(() => ({ theme, preference, setPreference }), [theme, preference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useAppTheme must be used within an AppThemeProvider");
  return ctx;
}

export function useAppTheme(): Theme {
  return useThemeContext().theme;
}

export function useThemePreference(): { preference: ThemePreference; setPreference: (pref: ThemePreference) => void } {
  const { preference, setPreference } = useThemeContext();
  return { preference, setPreference };
}
