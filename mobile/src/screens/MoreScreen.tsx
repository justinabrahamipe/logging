import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { ThemePreference, useThemePreference } from "../context/ThemeContext";
import SegmentedControl from "../components/SegmentedControl";
import { useAppTheme } from "../hooks/useAppTheme";
import { MoreStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<MoreStackParamList, "MoreMenu">;

const ITEMS: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; target: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "stats-chart-outline", target: "Dashboard" },
  { key: "goals", label: "Goals", icon: "flag-outline", target: "GoalsStack" },
  { key: "cycles", label: "Cycles", icon: "sync-outline", target: "CyclesStack" },
  { key: "pillars", label: "Pillars", icon: "layers-outline", target: "PillarsStack" },
];

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export default function MoreScreen({ navigation }: Props) {
  const theme = useAppTheme();
  const { logout } = useAuth();
  const { preference, setPreference } = useThemePreference();

  const confirmLogout = () => {
    Alert.alert("Sign out", "You'll need to sign in again.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.bg }]} edges={["top"]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>More</Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.subtext }]}>Appearance</Text>
        <SegmentedControl theme={theme} options={THEME_OPTIONS} value={preference} onChange={setPreference} />
      </View>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {ITEMS.map((item, i) => (
          <Pressable
            key={item.key}
            style={[styles.row, i < ITEMS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border }]}
            onPress={() => navigation.navigate(item.target as never)}
          >
            <Ionicons name={item.icon} size={20} color={theme.text} style={styles.icon} />
            <Text style={[styles.label, { color: theme.text }]}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.subtext} />
          </Pressable>
        ))}
      </View>

      <Pressable style={[styles.signOutButton, { borderColor: theme.danger }]} onPress={confirmLogout}>
        <Text style={[styles.signOutText, { color: theme.danger }]}>Sign out</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  title: { fontSize: 28, fontWeight: "700" },
  section: { marginHorizontal: 16, marginTop: 16 },
  sectionTitle: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  card: { margin: 16, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  icon: { width: 22 },
  label: { flex: 1, fontSize: 15, fontWeight: "500" },
  signOutButton: {
    marginTop: "auto",
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  signOutText: { fontSize: 15, fontWeight: "600" },
});
