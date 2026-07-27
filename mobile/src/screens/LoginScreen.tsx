import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { normalizeBaseUrl } from "../api/client";
import { fonts } from "../fonts";
import { useAppTheme } from "../hooks/useAppTheme";

const DEFAULT_BASE_URL = "https://www.grindconsole.com";

export default function LoginScreen() {
  const theme = useAppTheme();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const cleanBaseUrl = normalizeBaseUrl(DEFAULT_BASE_URL);
      const redirectUri = Linking.createURL("auth");
      const authUrl = `${cleanBaseUrl}/mobile-auth?redirect_uri=${encodeURIComponent(redirectUri)}`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
      if (result.type === "success" && result.url) {
        const { queryParams } = Linking.parse(result.url);
        const key = queryParams?.apiKey;
        const returnedBaseUrl = typeof queryParams?.baseUrl === "string" ? queryParams.baseUrl : cleanBaseUrl;
        if (typeof key === "string" && key) {
          await login(returnedBaseUrl, key);
        } else {
          setError("Google sign-in didn't return a key. Please try again.");
        }
      }
    } catch {
      setError("Couldn't complete Google sign-in.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <View style={styles.container}>
        <Image source={require("../../assets/logo.png")} style={[styles.logo, { borderColor: theme.border }]} />
        <Text style={[styles.title, { color: theme.text, fontFamily: fonts.display }]}>Grind Console</Text>
        <Text style={[styles.subtitle, { color: theme.subtext, fontFamily: fonts.body }]}>Sign in to continue.</Text>

        <Pressable
          style={[styles.googleButton, { borderColor: theme.border, backgroundColor: theme.card, opacity: googleLoading ? 0.6 : 1 }]}
          onPress={handleGoogleSignIn}
          disabled={googleLoading}
        >
          {googleLoading ? (
            <ActivityIndicator color={theme.text} />
          ) : (
            <>
              <Ionicons name="logo-google" size={18} color={theme.text} />
              <Text style={[styles.googleButtonText, { color: theme.text, fontFamily: fonts.bodySemiBold }]}>Continue with Google</Text>
            </>
          )}
        </Pressable>

        {error && <Text style={[styles.error, { color: theme.danger, fontFamily: fonts.body }]}>{error}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, justifyContent: "center", padding: 24 },
  logo: { width: 72, height: 72, borderRadius: 8, borderWidth: 1, alignSelf: "center", marginBottom: 16 },
  title: { fontSize: 26, marginBottom: 8, textAlign: "center" },
  subtitle: { fontSize: 14, marginBottom: 32, textAlign: "center" },
  googleButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  googleButtonText: { fontSize: 15 },
  error: { marginTop: 16, fontSize: 13, textAlign: "center" },
});
