import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Goal } from "../api/types";
import { Theme } from "../theme";

type Props = {
  theme: Theme;
  goal: Goal;
  completions: { date: string; value: number; completed: boolean }[];
  today: string;
  days?: number;
};

export default function GoalHeatmap({ theme, goal, completions, today, days = 30 }: Props) {
  const cells = useMemo(() => {
    const doneDates = new Set(completions.filter((c) => c.completed || c.value > 0).map((c) => c.date));
    const scheduleDays = goal.scheduleDays ?? [];
    const result: { date: string; status: "done" | "missed" | "skip" }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(`${today}T12:00:00`);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const beforeStart = !!goal.startDate && dateStr < goal.startDate;
      const notScheduled = scheduleDays.length > 0 && !scheduleDays.includes(d.getDay());
      if (beforeStart || notScheduled) {
        result.push({ date: dateStr, status: "skip" });
      } else {
        result.push({ date: dateStr, status: doneDates.has(dateStr) ? "done" : "missed" });
      }
    }
    return result;
  }, [completions, goal.scheduleDays, goal.startDate, today, days]);

  return (
    <View style={styles.row}>
      {cells.map((c) => (
        <View
          key={c.date}
          style={[
            styles.cell,
            {
              backgroundColor:
                c.status === "done" ? (goal.pillarColor || theme.warning) : c.status === "missed" ? theme.border : "transparent",
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 2, marginTop: 6, flexWrap: "wrap" },
  cell: { width: 6, height: 6, borderRadius: 1 },
});
