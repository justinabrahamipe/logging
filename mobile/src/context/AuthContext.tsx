import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { api, setSession } from "../api/client";

// Exported so the widget's headless JS task (widget/widgetTaskHandler.ts) can hydrate
// the same session — it never mounts AuthProvider, since that would boot the full app.
export const BASE_URL_KEY = "grindconsole.baseUrl";
export const API_KEY_KEY = "grindconsole.apiKey";

type AuthContextValue = {
  isLoading: boolean;
  isSignedIn: boolean;
  baseUrl: string | null;
  login: (baseUrl: string, apiKey: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    (async () => {
      const [storedUrl, storedKey] = await Promise.all([
        SecureStore.getItemAsync(BASE_URL_KEY),
        SecureStore.getItemAsync(API_KEY_KEY),
      ]);
      if (storedUrl && storedKey) {
        setSession(storedUrl, storedKey);
        setBaseUrl(storedUrl);
        setIsSignedIn(true);
      }
      setIsLoading(false);
    })();
  }, []);

  const login = async (url: string, apiKey: string) => {
    await SecureStore.setItemAsync(BASE_URL_KEY, url);
    await SecureStore.setItemAsync(API_KEY_KEY, apiKey);
    setSession(url, apiKey);
    setBaseUrl(url);
    setIsSignedIn(true);
  };

  const logout = async () => {
    try {
      await api.delete("/api/settings/api-key");
    } catch {
      // best-effort revoke; still clear local credentials below
    }
    await SecureStore.deleteItemAsync(BASE_URL_KEY);
    await SecureStore.deleteItemAsync(API_KEY_KEY);
    setSession(null, null);
    setBaseUrl(null);
    setIsSignedIn(false);
  };

  const value = useMemo(
    () => ({ isLoading, isSignedIn, baseUrl, login, logout }),
    [isLoading, isSignedIn, baseUrl]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
