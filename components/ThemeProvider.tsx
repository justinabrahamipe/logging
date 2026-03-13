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
  } else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (prefersDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [dateFormat, setDateFormatState] = useState<DateFormat>("DD/MM/YYYY");
  const [timeFormat, setTimeFormatState] = useState<TimeFormat>("12h");
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences: localStorage first, then API as fallback, then system default
  useEffect(() => {
    async function loadPreferences() {
      // 1. Check localStorage first
      const localTheme = localStorage.getItem("theme") as Theme | null;
      const localDateFmt = localStorage.getItem("dateFormat") as DateFormat | null;
      const localTimeFmt = localStorage.getItem("timeFormat") as TimeFormat | null;

      if (localTheme) {
        setThemeState(localTheme);
        applyTheme(localTheme);
      }
      if (localDateFmt) setDateFormatState(localDateFmt);
      if (localTimeFmt) setTimeFormatState(localTimeFmt);

      // 2. If localStorage had theme, we're done — no API call needed
      if (localTheme) {
        setIsLoading(false);
        return;
      }

      // 3. No localStorage — try API
      try {
        const response = await fetch("/api/settings");
        if (response.ok) {
          const data = await response.json();
          if (data.theme) {
            setThemeState(data.theme);
            applyTheme(data.theme);
            localStorage.setItem("theme", data.theme);
          } else {
            // API has no theme saved — use system
            applyTheme("system");
          }
          if (data.dateFormat) { setDateFormatState(data.dateFormat); localStorage.setItem("dateFormat", data.dateFormat); }
          if (data.timeFormat) { setTimeFormatState(data.timeFormat); localStorage.setItem("timeFormat", data.timeFormat); }
        } else {
          // API failed — use system
          applyTheme("system");
        }
      } catch {
        // Network error — use system
        applyTheme("system");
      } finally {
        setIsLoading(false);
      }
    }

    loadPreferences();
  }, []);

  // Listen for system theme changes when theme is "system"
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyTheme("system");

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    localStorage.setItem("theme", newTheme);

    // Lazy save to DB
    fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: newTheme }),
    }).catch(() => {});
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
