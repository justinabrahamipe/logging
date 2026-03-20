"use client";

import { FaFire } from "react-icons/fa";
import type { OutcomeData } from "@/lib/types";

interface HabitTrackerProps {
  outcomesData: OutcomeData[];
  completionDates: Record<number, { date: string; value: number }[]>;
  today: string;
}

export default function HabitTracker({ outcomesData, completionDates, today }: HabitTrackerProps) {
  const habitGoals = outcomesData.filter(o => o.goalType === 'habitual');
  if (habitGoals.length === 0) return null;

  const days: string[] = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }

  const dayLabels = days.map(d => {
    const date = new Date(d + 'T12:00:00');
    return ['S','M','T','W','T','F','S'][date.getDay()];
  });

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FaFire className="text-lg text-orange-500" />
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Habits</h2>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-zinc-400 dark:text-zinc-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" /> Hit</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" /> Partial</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" /> Miss</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-zinc-200 dark:bg-zinc-700 inline-block" /> Rest</span>
        </div>
      </div>

      {/* Day labels */}
      <div className="flex items-center gap-0 mb-1">
        <div className="w-28 shrink-0" />
        <div className="flex-1 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
          {dayLabels.map((label, i) => (
            <div key={i} className="text-[9px] text-zinc-400 dark:text-zinc-500 text-center">{label}</div>
          ))}
        </div>
      </div>

      {/* Goal rows */}
      <div className="space-y-1">
        {habitGoals.map(goal => {
          const scheduleDays: number[] = goal.scheduleDays ? JSON.parse(goal.scheduleDays) : [];
          const entries = completionDates[goal.id] || [];

          // Build a map of date -> total value for this goal
          // Entries with value=-1 are postponed markers (task moved to another day)
          const dateValues = new Map<string, number>();
          const postponedSet = new Set<string>();
          for (const e of entries) {
            if (e.value === -1) {
              postponedSet.add(e.date);
            } else {
              dateValues.set(e.date, (dateValues.get(e.date) || 0) + e.value);
            }
          }
          const doneDates = new Set(dateValues.keys());

          return (
            <div key={goal.id} className="flex items-center gap-0">
              <div className="w-28 shrink-0 flex items-center gap-1.5 min-w-0">
                {goal.pillarEmoji && <span className="text-xs">{goal.pillarEmoji}</span>}
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">{goal.name}</span>
              </div>
              <div className="flex-1 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
                {days.map(dateStr => {
                  const d = new Date(dateStr + 'T12:00:00');
                  const dow = d.getDay();
                  const isScheduled = scheduleDays.length === 0 || scheduleDays.includes(dow);
                  const isBeforeStart = goal.startDate && dateStr < goal.startDate;
                  const isFuture = dateStr > today;

                  if (isBeforeStart || isFuture) {
                    return <div key={dateStr} className="aspect-square rounded-sm bg-zinc-100 dark:bg-zinc-800 opacity-30" />;
                  }
                  if (!isScheduled) {
                    return <div key={dateStr} className="aspect-square rounded-sm bg-zinc-200 dark:bg-zinc-700 opacity-40" />;
                  }

                  if (doneDates.has(dateStr)) {
                    // Check if partial (has dailyTarget and value < dailyTarget)
                    const dayVal = dateValues.get(dateStr) || 0;
                    if (goal.dailyTarget && goal.completionType !== 'checkbox' && dayVal < goal.dailyTarget) {
                      return <div key={dateStr} className="aspect-square rounded-sm bg-amber-400" />;
                    }
                    return <div key={dateStr} className="aspect-square rounded-sm bg-green-500" />;
                  }
                  // Postponed tasks show as rest (neutral) instead of miss
                  if (postponedSet.has(dateStr)) {
                    return <div key={dateStr} className="aspect-square rounded-sm bg-zinc-200 dark:bg-zinc-700 opacity-40" />;
                  }
                  return <div key={dateStr} className="aspect-square rounded-sm bg-red-400" />;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
