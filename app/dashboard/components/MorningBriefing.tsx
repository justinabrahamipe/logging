"use client";

import { FaSun } from "react-icons/fa";
import type { HistoryData } from "@/lib/types";
import { getYesterdayString } from "@/lib/format";

interface MorningBriefingProps {
  history: HistoryData;
  currentStreak: number;
  todayTaskCount: number;
}

function getStreakMessage(streak: number) {
  if (streak >= 30) return "Unstoppable. Keep dominating.";
  if (streak >= 14) return "Two weeks strong. You're building something real.";
  if (streak >= 7) return "A full week! Momentum is on your side.";
  if (streak >= 3) return "Nice streak going. Don't break the chain.";
  if (streak >= 1) return "Good start. Let's keep it going today.";
  return "New day, fresh start. Let's make it count.";
}

export default function MorningBriefing({ history, currentStreak, todayTaskCount }: MorningBriefingProps) {
  const yesterdayStr = getYesterdayString();
  const yesterdayScore = history.scores.find(s => s.date === yesterdayStr);

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <FaSun className="text-2xl text-amber-500" />
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
          Today&apos;s Briefing
        </h2>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-zinc-900 dark:text-white">
            {yesterdayScore ? `${yesterdayScore.actionScore}%` : "\u2014"}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Yesterday
          </div>
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold text-orange-500">
            {currentStreak}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Day Streak
          </div>
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold text-zinc-900 dark:text-white">
            {todayTaskCount}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Tasks Today
          </div>
        </div>
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center italic">
        {getStreakMessage(currentStreak)}
      </p>
    </div>
  );
}
