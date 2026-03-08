"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark" | "system";
type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" | "DD-MM-YYYY" | "MM-DD-YYYY";
type TimeFormat = "12h" | "24h";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
  setDateFormat: (f: DateFormat) => void;
  setTimeFormat: (f: TimeFormat) => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

function applyTheme(themeValue: Theme) {
  if (themeValue === "dark") {
    document.documentElement.classList.add("dark");
  } else if (themeValue === "light") {
    document.documentElement.classList.remove("dark");
  } else if (themeValue === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (prefersDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [dateFormat, setDateFormatState] = useState<DateFormat>("DD/MM/YYYY");
  const [timeFormat, setTimeFormatState] = useState<TimeFormat>("12h");
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences from database on mount
  useEffect(() => {
    async function loadPreferences() {
      try {
        const response = await fetch("/api/settings");
        if (response.ok) {
          const data = await response.json();
          const userTheme = (data.theme || "light") as Theme;
          setThemeState(userTheme);
          applyTheme(userTheme);
          localStorage.setItem("theme", userTheme);
          if (data.dateFormat) { setDateFormatState(data.dateFormat); localStorage.setItem("dateFormat", data.dateFormat); }
          if (data.timeFormat) { setTimeFormatState(data.timeFormat); localStorage.setItem("timeFormat", data.timeFormat); }
        }
      } catch (error) {
        console.error("Failed to load preferences:", error);
        const localTheme = localStorage.getItem("theme") as Theme;
        if (localTheme) { setThemeState(localTheme); applyTheme(localTheme); } else { applyTheme("light"); }
        const localDateFmt = localStorage.getItem("dateFormat") as DateFormat;
        if (localDateFmt) setDateFormatState(localDateFmt);
        const localTimeFmt = localStorage.getItem("timeFormat") as TimeFormat;
        if (localTimeFmt) setTimeFormatState(localTimeFmt);
      } finally {
        setIsLoading(false);
      }
    }

    loadPreferences();
  }, []);

  // Listen for system theme changes when theme is set to "system"
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      applyTheme("system");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  const setDateFormat = (f: DateFormat) => {
    setDateFormatState(f);
    localStorage.setItem("dateFormat", f);
  };

  const setTimeFormat = (f: TimeFormat) => {
    setTimeFormatState(f);
    localStorage.setItem("timeFormat", f);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, dateFormat, timeFormat, setDateFormat, setTimeFormat, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
}
