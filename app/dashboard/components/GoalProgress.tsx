"use client";

import { motion } from "framer-motion";
import { FaTrophy } from "react-icons/fa";
import Link from "next/link";
import type { OutcomeData } from "@/lib/types";

interface GoalProgressProps {
  outcomesData: OutcomeData[];
  completionDates: Record<number, string[]>;
  today: string;
}

export default function GoalProgress({ outcomesData, completionDates, today }: GoalProgressProps) {
  if (outcomesData.length === 0) return null;

  const totalProgress = outcomesData.reduce((sum, o) => {
    if (o.goalType === 'habitual') {
      const doneDates = completionDates[o.id] || [];
      const scheduleDays: number[] = o.scheduleDays ? JSON.parse(o.scheduleDays) : [];
      const start = o.startDate || today;
      let expected = 0;
      const d = new Date(start + 'T00:00:00');
      const endD = new Date(today + 'T00:00:00');
      while (d <= endD) {
        if (scheduleDays.length === 0 || scheduleDays.includes(d.getDay())) expected++;
        d.setDate(d.getDate() + 1);
      }
      const hits = doneDates.filter(dt => dt >= start && dt <= today).length;
      return sum + (expected > 0 ? Math.min((hits / expected) * 100, 100) : 100);
    }
    const range = Math.abs(o.targetValue - o.startValue);
    if (range === 0) return sum + 100;
    const p = Math.abs(o.currentValue - o.startValue) / range * 100;
    return sum + Math.max(0, Math.min(p, 100));
  }, 0);
  const overallPct = Math.round(totalProgress / outcomesData.length);

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
          animate={{ width: `${Math.min(overallPct, 100)}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full bg-emerald-500"
        />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {outcomesData.map((goal) => {
          const isHabitual = goal.goalType === 'habitual';
          const range = Math.abs(goal.targetValue - goal.startValue);

          let progress: number;
          let subtitle: string;
          if (isHabitual) {
            const doneDates = completionDates[goal.id] || [];
            const scheduleDays: number[] = goal.scheduleDays ? JSON.parse(goal.scheduleDays) : [];
            const start = goal.startDate || today;
            const end = today;
            let expected = 0;
            const d = new Date(start + 'T00:00:00');
            const endD = new Date(end + 'T00:00:00');
            while (d <= endD) {
              if (scheduleDays.length === 0 || scheduleDays.includes(d.getDay())) expected++;
              d.setDate(d.getDate() + 1);
            }
            const hits = doneDates.filter(dt => dt >= start && dt <= end).length;
            progress = expected > 0 ? Math.round((hits / expected) * 100) : 100;
            subtitle = `${hits} / ${expected} days`;
          } else {
            progress = range === 0 ? 100 : Math.round(Math.max(0, Math.min(
              Math.abs(goal.currentValue - goal.startValue) / range * 100, 100
            )));
            subtitle = `${goal.currentValue} / ${goal.targetValue} ${goal.unit}`;
          }
          const progressColor = progress < 30 ? "#EF4444" : progress < 60 ? "#F59E0B" : "#22C55E";

          return (
            <div
              key={goal.id}
              className="relative rounded-xl p-3 overflow-hidden border border-zinc-200 dark:border-zinc-700"
            >
              <div
                className="absolute inset-0 opacity-15 dark:opacity-20"
                style={{
                  background: progressColor,
                  width: `${progress}%`,
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
