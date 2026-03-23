"use client";

import { motion } from "framer-motion";
import { FaTrophy } from "react-icons/fa";
import Link from "next/link";
import { getProgressColor } from "@/lib/scoring";
import type { OutcomeData } from "@/lib/types";

interface GoalProgressProps {
  outcomesData: OutcomeData[];
  completionDates: Record<number, { date: string; value: number }[]>;
  today: string;
}

export default function GoalProgress({ outcomesData, completionDates, today }: GoalProgressProps) {
  if (outcomesData.length === 0) return null;

  // Pre-compute expected days for habitual goals so we can filter out 0/0
  const getExpectedDays = (o: OutcomeData) => {
    const scheduleDays: number[] = o.scheduleDays ? JSON.parse(o.scheduleDays) : [];
    const start = o.startDate || today;
    let expected = 0;
    const d = new Date(start + 'T00:00:00');
    const endD = new Date(today + 'T00:00:00');
    while (d <= endD) {
      if (scheduleDays.length === 0 || scheduleDays.includes(d.getDay())) expected++;
      d.setDate(d.getDate() + 1);
    }
    return expected;
  };

  // Compute proportional hits for a habitual goal
  const getHabitualHits = (o: OutcomeData, expected: number) => {
    const entries = completionDates[o.id] || [];
    const start = o.startDate || today;

    // Filter: in range, positive value (exclude postpone markers -1)
    const filtered = entries.filter(e => e.date >= start && e.date <= today && e.value > 0);

    // For checkbox goals (no dailyTarget), keep binary
    if (!o.dailyTarget || o.completionType === 'checkbox') {
      const uniqueDates = new Set(filtered.map(e => e.date));
      return Math.min(uniqueDates.size, expected);
    }

    // Proportional: sum up fractional credit per day, capped at 1.0 per day
    const dayValues = new Map<string, number>();
    for (const e of filtered) {
      dayValues.set(e.date, (dayValues.get(e.date) || 0) + e.value);
    }
    let hits = 0;
    for (const val of dayValues.values()) {
      hits += Math.min(val / o.dailyTarget, 1);
    }
    return Math.min(hits, expected);
  };

  // Hide goals that haven't started yet
  const visibleGoals = outcomesData.filter((o) => {
    const start = o.startDate || today;
    if (start > today) return false;
    if (o.goalType === 'habitual' && getExpectedDays(o) === 0) return false;
    return true;
  });

  if (visibleGoals.length === 0) return null;

  const totalProgress = visibleGoals.reduce((sum, o) => {
    if (o.goalType === 'habitual') {
      const expected = getExpectedDays(o);
      const hits = getHabitualHits(o, expected);
      return sum + (expected > 0 ? Math.min((hits / expected) * 100, 100) : 0);
    }
    const range = o.targetValue - o.startValue;
    if (range === 0) return sum;
    const p = (o.currentValue - o.startValue) / range * 100;
    return sum + Math.min(p, 100);
  }, 0);
  const overallPct = Math.round(totalProgress / visibleGoals.length);

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 mb-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <FaTrophy className="text-lg text-emerald-500" />
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Goals</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-emerald-500">{overallPct}%</span>
          <Link href="/goals">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300">View All</span>
          </Link>
        </div>
      </div>
      <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden mb-3">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(overallPct, 100))}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full bg-emerald-500"
        />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {visibleGoals.map((goal) => {
          const isHabitual = goal.goalType === 'habitual';
          const range = goal.targetValue - goal.startValue;

          let progress: number;
          let subtitle: string;
          if (isHabitual) {
            const expected = getExpectedDays(goal);
            const hits = getHabitualHits(goal, expected);
            progress = expected > 0 ? Math.round((hits / expected) * 100) : 0;
            const hitsDisplay = Number.isInteger(hits) ? hits : hits.toFixed(1);
            subtitle = `${hitsDisplay} / ${expected} days`;
          } else {
            progress = range === 0 ? 0 : Math.round(Math.min(
              (goal.currentValue - goal.startValue) / range * 100, 100
            ));
            subtitle = `${goal.currentValue} / ${goal.targetValue} ${goal.unit}`;
          }
          const progressColor = getProgressColor(progress);

          return (
            <div
              key={goal.id}
              className="relative rounded-xl p-3 overflow-hidden border border-zinc-200 dark:border-zinc-700"
            >
              <div
                className="absolute inset-0 opacity-15 dark:opacity-20"
                style={{
                  background: progressColor,
                  width: `${Math.max(0, progress)}%`,
                }}
              />
              <div className="relative">
                <div className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{goal.name}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-lg font-bold" style={{ color: progressColor }}>{progress}%</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
