"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { Outcome, LogEntry } from "../types";

export default function ProgressChart({ outcome, logs, color }: {
  outcome: Outcome;
  logs: LogEntry[];
  color: string;
}) {
  if (logs.length === 0) return null;

  const sorted = [...logs].sort(
    (a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime()
  );

  const DAY_MS = 86400000;
  const isTarget = outcome.goalType === "target";

  if (isTarget) {
    // Cumulative chart for target goals
    const firstLogTime = new Date(sorted[0].loggedAt).getTime();
    const outcomeStartTime = outcome.startDate
      ? new Date(outcome.startDate + "T00:00:00").getTime()
      : firstLogTime;
    const startDay = Math.floor(Math.min(outcomeStartTime, firstLogTime) / DAY_MS) * DAY_MS;
    const endDate = outcome.targetDate
      ? new Date(outcome.targetDate + "T00:00:00")
      : new Date(sorted[sorted.length - 1].loggedAt);
    const endDay = Math.floor(endDate.getTime() / DAY_MS) * DAY_MS;

    const toDayNum = (ts: number) => Math.round((ts - startDay) / DAY_MS);

    let cumulative = 0;
    const chartData: { day: number; actual: number | null; ideal: number | null; required: number | null }[] = [
      { day: 0, actual: 0, ideal: 0, required: 0 },
    ];

    for (const log of sorted) {
      cumulative += log.value;
      chartData.push({
        day: toDayNum(new Date(log.loggedAt).getTime()),
        actual: cumulative,
        ideal: null,
        required: null,
      });
    }

    const endDayNum = toDayNum(endDay);
    if (endDayNum > 0) {
      chartData[0].ideal = 0;
      const lastEntry = chartData[chartData.length - 1];
      if (lastEntry.day < endDayNum) {
        chartData.push({ day: endDayNum, actual: null, ideal: outcome.targetValue, required: outcome.targetValue });
      } else {
        lastEntry.ideal = outcome.targetValue;
        lastEntry.required = outcome.targetValue;
      }
    }

    // "Required" line: from start (0) through current progress today to target by end date
    const todayDayNum = toDayNum(Math.floor(Date.now() / DAY_MS) * DAY_MS);
    const currentProgress = cumulative;
    if (endDayNum > 0) {
      const todayEntry = chartData.find(d => d.day === todayDayNum);
      if (todayEntry) {
        todayEntry.required = currentProgress;
      } else if (todayDayNum > 0 && todayDayNum < endDayNum) {
        chartData.push({ day: todayDayNum, actual: null, ideal: null, required: currentProgress });
      }
    }

    // Sort by day for proper rendering
    chartData.sort((a, b) => a.day - b.day);

    const maxDay = Math.max(endDayNum, chartData[chartData.length - 1].day, 1);
    const formatDay = (day: number) => {
      const d = new Date(startDay + day * DAY_MS);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    };

    return (
      <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <XAxis
              dataKey="day"
              type="number"
              domain={[0, maxDay]}
              tickFormatter={formatDay}
              tick={{ fontSize: 11, fill: "#9CA3AF" }}
              tickLine={false}
              axisLine={{ stroke: "#374151" }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#9CA3AF" }}
              tickLine={false}
              axisLine={{ stroke: "#374151" }}
              domain={[0, "auto"]}
            />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: "var(--tooltip-bg, #1F2937)",
                border: "1px solid #374151",
                borderRadius: "8px",
                color: "var(--tooltip-text, #F9FAFB)",
                fontSize: 12,
              }}
              labelFormatter={(day) => formatDay(day as number)}
              formatter={(value, name) => [
                `${value} ${outcome.unit}`,
                name === "actual" ? "Actual" : name === "required" ? "Required" : "Original Plan",
              ]}
            />
            <Line
              type="linear"
              dataKey="ideal"
              stroke="#9CA3AF"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              connectNulls
            />
            <Line
              type="linear"
              dataKey="required"
              stroke="#F59E0B"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke={color}
              strokeWidth={2}
              dot={{ fill: color, r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Standard outcome chart
  const firstLogTime = new Date(sorted[0].loggedAt).getTime();
  const outcomeStartTime = outcome.startDate
    ? new Date(outcome.startDate + "T00:00:00").getTime()
    : firstLogTime;
  const startDay = Math.floor(Math.min(outcomeStartTime, firstLogTime) / DAY_MS) * DAY_MS;
  const endDate = outcome.targetDate
    ? new Date(outcome.targetDate)
    : new Date(sorted[sorted.length - 1].loggedAt);
  const endDay = Math.floor(endDate.getTime() / DAY_MS) * DAY_MS;

  const toDayNum = (ts: number) => Math.round((ts - startDay) / DAY_MS);

  const startPoint = {
    day: 0,
    actual: outcome.startValue as number | null,
    target: outcome.startValue as number | null,
  };

  const logPoints = sorted.map((log) => ({
    day: toDayNum(new Date(log.loggedAt).getTime()),
    actual: log.value as number | null,
    target: null as number | null,
  }));

  const lastLogDay = logPoints[logPoints.length - 1].day;
  const endDayNum = toDayNum(endDay);
  const needsEndPoint = endDayNum > lastLogDay;

  const endPoint = {
    day: endDayNum,
    actual: null as number | null,
    target: outcome.targetValue as number | null,
  };

  if (!needsEndPoint && logPoints.length > 0) {
    logPoints[logPoints.length - 1].target = outcome.targetValue;
  }

  const chartData = [startPoint, ...logPoints, ...(needsEndPoint ? [endPoint] : [])];
  const maxDay = Math.max(endDayNum, lastLogDay, 1);
  const formatDay = (day: number) => {
    const d = new Date(startDay + day * DAY_MS);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <XAxis
            dataKey="day"
            type="number"
            domain={[0, maxDay]}
            tickFormatter={formatDay}
            tick={{ fontSize: 11, fill: "#9CA3AF" }}
            tickLine={false}
            axisLine={{ stroke: "#374151" }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#9CA3AF" }}
            tickLine={false}
            axisLine={{ stroke: "#374151" }}
            domain={["auto", "auto"]}
          />
          <RechartsTooltip
            contentStyle={{
              backgroundColor: "var(--tooltip-bg, #1F2937)",
              border: "1px solid #374151",
              borderRadius: "8px",
              color: "var(--tooltip-text, #F9FAFB)",
              fontSize: 12,
            }}
            labelFormatter={(day) => formatDay(day as number)}
            formatter={(value, name) => [
              `${value} ${outcome.unit}`,
              name === "actual" ? "Actual" : "Target",
            ]}
          />
          <Line
            type="linear"
            dataKey="target"
            stroke="#9CA3AF"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke={color}
            strokeWidth={2}
            dot={{ fill: color, r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
