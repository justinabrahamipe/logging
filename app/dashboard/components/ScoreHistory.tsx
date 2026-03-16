"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import type { HistoryScore } from "@/lib/types";
import DateRangeSelector from "./DateRangeSelector";
import { getPresetDates, filterScoresByRange } from "./utils";

interface ScoreHistoryProps {
  scores: HistoryScore[];
}

export default function ScoreHistory({ scores }: ScoreHistoryProps) {
  const [preset, setPreset] = useState("month");
  const [startDate, setStartDate] = useState(() => getPresetDates("month").start);
  const [endDate, setEndDate] = useState(() => getPresetDates("month").end);

  const handlePreset = (p: string) => {
    setPreset(p);
    if (p !== "custom") {
      const { start, end } = getPresetDates(p);
      setStartDate(start);
      setEndDate(end);
    }
  };

  const filtered = useMemo(() => filterScoresByRange(scores, startDate, endDate), [scores, startDate, endDate]);

  const data = useMemo(() => {
    return [...filtered]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => ({
        date: s.date.slice(5),
        fullDate: s.date,
        action: s.actionScore,
        momentum: s.momentumScore ?? null,
      }));
  }, [filtered]);

  const hasMomentum = data.some((d) => d.momentum !== null);

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
          {hasMomentum ? "Action Score & Momentum" : "Score Trend"}
        </h2>
        <DateRangeSelector
          startDate={startDate} endDate={endDate}
          onChangeStart={setStartDate} onChangeEnd={setEndDate}
          preset={preset} onPreset={handlePreset}
        />
      </div>
      {data.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400 text-sm text-center py-8">
          No score data for this period.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#9CA3AF" }}
              tickLine={false}
              axisLine={{ stroke: "#374151" }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, hasMomentum ? 'auto' : 100]}
              tick={{ fontSize: 11, fill: "#9CA3AF" }}
              tickLine={false}
              axisLine={{ stroke: "#374151" }}
            />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: "var(--tooltip-bg, #1F2937)",
                border: "1px solid #374151",
                borderRadius: "8px",
                color: "var(--tooltip-text, #F9FAFB)",
                fontSize: 12,
              }}
              formatter={(value, name) => [
                `${value ?? 0}%`,
                name === "momentum" ? "Momentum" : "Action Score",
              ]}
              labelFormatter={(label: unknown) => `Date: ${label}`}
            />
            {hasMomentum && (
              <Legend
                formatter={(value: string) => value === "momentum" ? "Momentum" : "Action Score"}
              />
            )}
            <ReferenceLine
              y={hasMomentum ? 100 : 70}
              stroke="#22C55E"
              strokeDasharray="5 5"
              strokeOpacity={0.6}
              label={{
                value: hasMomentum ? "On Pace" : "Pass",
                position: "right",
                fill: "#22C55E",
                fontSize: 11,
              }}
            />
            <Line
              type="monotone"
              dataKey="action"
              stroke="#8B5CF6"
              strokeWidth={2}
              dot={{ fill: "#8B5CF6", r: 3 }}
              activeDot={{ r: 5, fill: "#A78BFA" }}
            />
            {hasMomentum && (
              <Line
                type="monotone"
                dataKey="momentum"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={{ fill: "#F59E0B", r: 3 }}
                activeDot={{ r: 5, fill: "#FCD34D" }}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
