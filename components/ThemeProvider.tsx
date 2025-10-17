"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
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
  const [isLoading, setIsLoading] = useState(true);

  // Load theme from database on mount
  useEffect(() => {
    async function loadTheme() {
      try {
        const response = await fetch("/api/preferences");
        if (response.ok) {
          const data = await response.json();
          const userTheme = (data.theme || "light") as Theme;
          setThemeState(userTheme);
          applyTheme(userTheme);
          // Save to localStorage for blocking script
          localStorage.setItem("theme", userTheme);
        }
      } catch (error) {
        console.error("Failed to load theme:", error);
        // Try to load from localStorage as fallback
        const localTheme = localStorage.getItem("theme") as Theme;
        if (localTheme) {
          setThemeState(localTheme);
          applyTheme(localTheme);
        } else {
          applyTheme("light");
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadTheme();
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
    // Save to localStorage for blocking script
    localStorage.setItem("theme", newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
}
