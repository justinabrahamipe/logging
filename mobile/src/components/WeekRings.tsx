import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Theme } from "../theme";
import { addDays, todayString } from "../utils/date";

type Entry = { date: string; actionScore: number };

function lastSevenDays(entries: Entry[]): Entry[] {
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const today = todayString();
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6);
    return byDate.get(date) ?? { date, actionScore: 0 };
  });
}

function dayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1);
}

const RING_SIZE = 32;
const STROKE = 4;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function Ring({ pct, theme }: { pct: number; theme: Theme }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = CIRCUMFERENCE * (1 - clamped / 100);
  return (
    <View style={styles.ringBox}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS} stroke={theme.border} strokeWidth={STROKE} fill="none" />
        {clamped > 0 && (
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke={theme.warning}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={offset}
            rotation={-90}
            origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
          />
        )}
      </Svg>
      <View style={styles.ringLabel} pointerEvents="none">
        <Text style={[styles.ringLabelText, { color: theme.text }]}>{Math.round(clamped)}</Text>
      </View>
    </View>
  );
}

export default function WeekRings({ theme, entries }: { theme: Theme; entries: Entry[] }) {
  const week = lastSevenDays(entries);

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.title, { color: theme.subtext }]}>Last 7 days</Text>
      <View style={styles.row}>
        {week.map((e) => (
          <View key={e.date} style={styles.col}>
            <Ring pct={e.actionScore} theme={theme} />
            <Text style={[styles.label, { color: theme.subtext }]}>{dayLabel(e.date)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14, marginBottom: 16 },
  title: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  col: { alignItems: "center", gap: 6 },
  ringBox: { width: RING_SIZE, height: RING_SIZE, alignItems: "center", justifyContent: "center" },
  ringLabel: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  ringLabelText: { fontSize: 8, fontWeight: "700" },
  label: { fontSize: 11, fontWeight: "600" },
});
