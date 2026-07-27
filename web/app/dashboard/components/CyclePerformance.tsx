"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { FaFire } from "react-icons/fa";
import { useTheme } from "@/components/ThemeProvider";

interface CycleData {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

interface ScoreEntry {
  date: string;
  actionScore: number;
  trajectoryScore: number | null;
}

interface CycleStats {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  avgScore: number;
  avgTrajectory: number | null;
  topStreak: number;
  totalDays: number;
}

export default function CyclePerformance() {
  const { data: session } = useSession();
  const { streakThreshold } = useTheme();
  const [cycleStats, setCycleStats] = useState<CycleStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) { setLoading(false); return; }

    Promise.all([
      fetch("/api/cycles").then(r => r.ok ? r.json() : []),
      fetch("/api/daily-score/history?days=365").then(r => r.ok ? r.json() : { scores: [] }),
      fetch("/api/goals").then(r => r.ok ? r.json() : []),
    ]).then(([cycles, historyData, goalsData]: [CycleData[], { scores: ScoreEntry[] }, { id: number; periodId: number | null; goalType: string; startValue: number; targetValue: number; currentValue: number; startDate: string | null; targetDate: string | null }[]]) => {
      const scores = historyData.scores || [];
      // Show only active cycles (currently running)
      const now = new Date();
      const sorted = cycles.filter((c: CycleData) => {
        const start = new Date(c.startDate + 'T00:00:00');
        const end = new Date(c.endDate + 'T23:59:59');
        return c.isActive && now >= start && now <= end;
      });

      const stats: CycleStats[] = sorted.map(cycle => {
        const inRange = scores.filter(s => s.date >= cycle.startDate && s.date <= cycle.endDate);
        if (inRange.length === 0) {
          return { id: cycle.id, name: cycle.name, startDate: cycle.startDate, endDate: cycle.endDate, isActive: cycle.isActive, avgScore: 0, avgTrajectory: null, topStreak: 0, totalDays: 0 };
        }

        const avgScore = Math.round(inRange.reduce((s, d) => s + d.actionScore, 0) / inRange.length);

        // Compute trajectory live from outcome goals in this cycle
        const cycleOutcomeGoals = goalsData.filter(g => g.periodId === cycle.id && g.goalType === "outcome" && g.startDate && g.targetDate);
        let avgTrajectory: number | null = null;
        if (cycleOutcomeGoals.length > 0) {
          const todayStr = new Date().toISOString().split("T")[0];
          const trajectories: number[] = [];
          for (const g of cycleOutcomeGoals) {
            const totalMs = new Date(g.targetDate!).getTime() - new Date(g.startDate!).getTime();
            if (totalMs <= 0) continue;
            const effectiveToday = todayStr > g.targetDate! ? g.targetDate! : todayStr < g.startDate! ? g.startDate! : todayStr;
            const elapsedMs = new Date(effectiveToday).getTime() - new Date(g.startDate!).getTime();
            const range = g.targetValue - (g.startValue || 0);
            if (range === 0) continue;
            const expectedValue = (g.startValue || 0) + range * (elapsedMs / totalMs);
            const deviation = (g.currentValue - expectedValue) / range;
            trajectories.push(1.0 + deviation);
          }
          if (trajectories.length > 0) {
            avgTrajectory = Math.round(trajectories.reduce((a, b) => a + b, 0) / trajectories.length * 10) / 10;
          }
        }

        const sortedScores = [...inRange].sort((a, b) => a.date.localeCompare(b.date));
        let maxStreak = 0, current = 0;
        for (const s of sortedScores) {
          if (s.actionScore >= streakThreshold) { current++; maxStreak = Math.max(maxStreak, current); }
          else { current = 0; }
        }

        return { id: cycle.id, name: cycle.name, startDate: cycle.startDate, endDate: cycle.endDate, isActive: cycle.isActive, avgScore, avgTrajectory, topStreak: maxStreak, totalDays: inRange.length };
      });

      setCycleStats(stats);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [session, streakThreshold]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6 animate-pulse">
        <div className="h-5 w-40 bg-zinc-200 dark:bg-zinc-700 rounded mb-4" />
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-16 bg-zinc-200 dark:bg-zinc-700 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (cycleStats.length === 0) return null;

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Cycles</h2>
      <div className="space-y-4">
        {cycleStats.map(cycle => {
          const start = new Date(cycle.startDate + "T00:00:00");
          const end = new Date(cycle.endDate + "T00:00:00");
          const now = new Date(new Date().toISOString().split("T")[0] + "T00:00:00");
          const elapsed = Math.max(0, Math.ceil((Math.min(now.getTime(), end.getTime()) - start.getTime()) / 86400000));
          const total = Math.ceil((end.getTime() - start.getTime()) / 86400000);
          const remaining = Math.max(0, total - elapsed);
          const pct = total > 0 ? Math.round((elapsed / total) * 100) : 0;

          return (
            <Link key={cycle.id} href={`/cycles/${cycle.id}`}>
              <div className="group rounded-xl p-4 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-700/30 cursor-pointer -mx-2">
                {/* Title row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{cycle.name}</h3>
                    {cycle.isActive && (
                      <span className="text-[10px] px-1.5 py-px rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">Active</span>
                    )}
                  </div>
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                    {remaining > 0 ? `${remaining}d left` : "Completed"}
                  </span>
                </div>

                {/* Time progress bar */}
                <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-700 rounded-full mb-3 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100 transition-all"
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>

                {/* Stats row */}
                {cycle.totalDays > 0 ? (
                  <div className="flex items-center gap-5">
                    <div className="text-center">
                      <p className="text-lg font-bold text-zinc-900 dark:text-white leading-none">{cycle.avgScore}%</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">Action</p>
                    </div>
                    {cycle.avgTrajectory !== null && (
                      <div className="text-center">
                        <p className={`text-lg font-bold leading-none ${cycle.avgTrajectory >= 1.0 ? "text-purple-500" : "text-red-500"}`}>
                          {cycle.avgTrajectory.toFixed(1)}x
                        </p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">Trajectory</p>
                      </div>
                    )}
                    {cycle.topStreak > 0 && (
                      <div className="text-center">
                        <p className="text-lg font-bold text-amber-500 leading-none flex items-center justify-center gap-1">
                          {cycle.topStreak} <FaFire className="text-xs" />
                        </p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">Streak</p>
                      </div>
                    )}
                    <div className="text-center ml-auto">
                      <p className="text-lg font-bold text-zinc-500 dark:text-zinc-400 leading-none">{elapsed}<span className="text-xs font-normal">/{total}</span></p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">Days</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400">No data yet</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
