import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Theme } from "../theme";

type Props = {
  theme: Theme;
  pct: number;
  size?: number;
};

export default function FlameGauge({ theme, pct, size = 44 }: Props) {
  const clamped = Math.max(0, Math.min(100, pct));

  return (
    <View style={styles.row}>
      <View style={{ width: size, height: size }}>
        <Ionicons name="flame" size={size} color={theme.border} style={StyleSheet.absoluteFill} />
        <View style={[styles.clip, { height: `${clamped}%` }]}>
          <Ionicons name="flame" size={size} color={theme.warning} style={[StyleSheet.absoluteFill, { top: undefined, bottom: 0 }]} />
        </View>
      </View>
      <View>
        <Text style={[styles.title, { color: theme.text }]}>Today&apos;s Fire</Text>
        <Text style={[styles.subtitle, { color: theme.subtext }]}>
          <Text style={{ color: theme.warning, fontWeight: "700" }}>{Math.round(clamped)}%</Text> of today&apos;s action score
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  clip: { position: "absolute", left: 0, right: 0, bottom: 0, overflow: "hidden" },
  title: { fontSize: 16, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 2 },
});
