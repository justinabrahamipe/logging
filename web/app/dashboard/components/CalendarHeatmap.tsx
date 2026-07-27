"use client";

import { useState, useMemo } from "react";
import type { HistoryScore } from "@/lib/types";
import DateRangeSelector from "./DateRangeSelector";
import { getHeatmapColor, getHeatmapOpacity, getPresetDates } from "./utils";

interface CalendarHeatmapProps {
  scores: HistoryScore[];
}

export default function CalendarHeatmap({ scores }: CalendarHeatmapProps) {
  const [preset, setPreset] = useState("quarter");
  const [startDate, setStartDate] = useState(() => getPresetDates("quarter").start);
  const [endDate, setEndDate] = useState(() => getPresetDates("quarter").end);
  const [tooltip, setTooltip] = useState<{
    date: string;
    score: number | null;
    x: number;
    y: number;
  } | null>(null);

  const handlePreset = (p: string) => {
    setPreset(p);
    if (p !== "custom") {
      const { start, end } = getPresetDates(p);
      setStartDate(start);
      setEndDate(end);
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];

  const { weeks } = useMemo(() => {
    const scoreMap = new Map<string, number>();
    for (const s of scores) {
      scoreMap.set(s.date, s.actionScore);
    }

    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    const daysArray: { date: string; score: number | null; isToday: boolean; dayOfWeek: number }[] = [];

    const d = new Date(start);
    while (d <= end) {
      const dateStr = d.toISOString().split("T")[0];
      daysArray.push({
        date: dateStr,
        score: scoreMap.get(dateStr) ?? null,
        isToday: dateStr === todayStr,
        dayOfWeek: d.getDay(),
      });
      d.setDate(d.getDate() + 1);
    }

    const weeksArray: typeof daysArray[] = [];
    let currentWeek: typeof daysArray = [];

    if (daysArray.length > 0) {
      const firstDow = daysArray[0].dayOfWeek;
      const mondayOffset = firstDow === 0 ? 6 : firstDow - 1;
      for (let i = 0; i < mondayOffset; i++) {
        currentWeek.push({ date: "", score: null, isToday: false, dayOfWeek: -1 });
      }
    }

    for (const day of daysArray) {
      const mondayDow = day.dayOfWeek === 0 ? 6 : day.dayOfWeek - 1;
      if (mondayDow === 0 && currentWeek.length > 0) {
        weeksArray.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(day);
    }
    if (currentWeek.length > 0) weeksArray.push(currentWeek);

    return { days: daysArray, weeks: weeksArray };
  }, [scores, startDate, endDate, todayStr]);

  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
          Heatmap
        </h2>
        <DateRangeSelector
          startDate={startDate} endDate={endDate}
          onChangeStart={setStartDate} onChangeEnd={setEndDate}
          preset={preset} onPreset={handlePreset}
        />
      </div>
      <div className="relative overflow-x-auto">
        <div className="flex gap-0.5">
          <div className="flex flex-col gap-0.5 mr-1">
            {dayLabels.map((label, i) => (
              <div
                key={i}
                className="w-4 h-4 text-[10px] text-zinc-400 dark:text-zinc-500 flex items-center justify-center"
              >
                {i % 2 === 0 ? label : ""}
              </div>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {week.map((day, di) => (
                <div
                  key={di}
                  className={`w-4 h-4 rounded-sm cursor-pointer transition-all ${
                    !day.date
                      ? "bg-transparent"
                      : day.isToday && (day.score === null || day.score < 95)
                      ? "bg-blue-400 dark:bg-blue-500 opacity-60"
                      : `${getHeatmapColor(day.score)} ${getHeatmapOpacity(day.score)}`
                  }`}
                  onMouseEnter={(e) => {
                    if (day.date) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltip({
                        date: day.date,
                        score: day.score,
                        x: rect.left,
                        y: rect.top - 40,
                      });
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              ))}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          <span>Less</span>
          <div className="w-3 h-3 rounded-sm bg-zinc-200 dark:bg-zinc-700 opacity-40" />
          <div className="w-3 h-3 rounded-sm bg-red-500 opacity-80" />
          <div className="w-3 h-3 rounded-sm bg-orange-500 opacity-80" />
          <div className="w-3 h-3 rounded-sm bg-yellow-500 opacity-80" />
          <div className="w-3 h-3 rounded-sm bg-emerald-400 opacity-90" />
          <div className="w-3 h-3 rounded-sm bg-green-500 opacity-100" />
          <span>More</span>
        </div>
      </div>

      {tooltip && (
        <div
          className="fixed z-50 px-2 py-1 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs rounded shadow-sm pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.date}: {tooltip.score !== null ? `${tooltip.score}%` : "No data"}
        </div>
      )}
    </div>
  );
}
