"use client";

import { useMemo } from "react";
import { FaFire, FaTimes } from "react-icons/fa";
import { useTheme } from "@/components/ThemeProvider";
import type { HistoryScore } from "@/lib/types";

interface StreakFlameChainProps {
  scores: HistoryScore[];
  currentStreak: number;
}

export default function StreakFlameChain({ scores, currentStreak }: StreakFlameChainProps) {
  const { streakThreshold } = useTheme();
  const days = useMemo(() => {
    const scoreMap = new Map<string, number>();
    for (const s of scores) {
      scoreMap.set(s.date, s.actionScore);
    }

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const result: { date: string; label: string; status: "pass" | "fail" | "today" | "none" }[] = [];

    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const score = scoreMap.get(dateStr);

      let status: "pass" | "fail" | "today" | "none";
      if (dateStr === todayStr) {
        status = score !== undefined && score >= streakThreshold ? "pass" : "today";
      } else {
        status = score === undefined ? "none" : score >= streakThreshold ? "pass" : "fail";
      }

      result.push({
        date: dateStr,
        label: d.toLocaleDateString("en-US", { weekday: "narrow" }),
        status,
      });
    }

    return result;
  }, [scores, streakThreshold]);

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
          Streak Chain
        </h2>
        <div className="flex items-center gap-2">
          <FaFire className="text-orange-500 text-lg" />
          <span className="text-2xl font-bold text-orange-500">{currentStreak}</span>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {currentStreak === 1 ? "day" : "days"}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-around gap-0.5 md:gap-1">
        {days.map((day, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5 md:gap-1 min-w-0 shrink-0">
            <span className="text-[9px] md:text-[10px] text-zinc-400 dark:text-zinc-500">
              {day.label}
            </span>
            <div
              className={`w-5 h-5 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[10px] md:text-sm ${
                day.status === "pass"
                  ? "bg-orange-500/20 text-orange-500"
                  : day.status === "today"
                  ? "bg-blue-500/20 text-blue-500 ring-1 ring-blue-400/50"
                  : day.status === "fail"
                  ? "bg-red-500/20 text-red-400"
                  : "bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500"
              }`}
            >
              {day.status === "pass" ? (
                <FaFire />
              ) : day.status === "today" ? (
                <span className="text-[8px] md:text-xs font-bold">...</span>
              ) : day.status === "fail" ? (
                <FaTimes className="text-[8px] md:text-xs" />
              ) : (
                <span className="text-[8px] md:text-xs">-</span>
              )}
            </div>
            <span className="text-[8px] md:text-[9px] text-zinc-400 dark:text-zinc-500">
              {day.date.slice(8)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
