"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { FaFire } from "react-icons/fa";

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
  const [cycleStats, setCycleStats] = useState<CycleStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) { setLoading(false); return; }

    Promise.all([
      fetch("/api/cycles").then(r => r.ok ? r.json() : []),
      fetch("/api/daily-score/history?days=365").then(r => r.ok ? r.json() : { scores: [] }),
    ]).then(([cycles, historyData]: [CycleData[], { scores: ScoreEntry[] }]) => {
      const scores = historyData.scores || [];
      // Sort cycles by start date desc, take last 4
      const sorted = [...cycles].sort((a, b) => b.startDate.localeCompare(a.startDate)).slice(0, 4);

      const stats: CycleStats[] = sorted.map(cycle => {
        const inRange = scores.filter(s => s.date >= cycle.startDate && s.date <= cycle.endDate);
        if (inRange.length === 0) {
          return { id: cycle.id, name: cycle.name, startDate: cycle.startDate, endDate: cycle.endDate, isActive: cycle.isActive, avgScore: 0, avgTrajectory: null, topStreak: 0, totalDays: 0 };
        }

        const avgScore = Math.round(inRange.reduce((s, d) => s + d.actionScore, 0) / inRange.length);

        const trajScores = inRange.filter(s => s.trajectoryScore != null);
        const avgTrajectory = trajScores.length > 0
          ? Math.round(trajScores.reduce((s, d) => s + (d.trajectoryScore || 0), 0) / trajScores.length) / 100
          : null;

        const sortedScores = [...inRange].sort((a, b) => a.date.localeCompare(b.date));
        let maxStreak = 0, current = 0;
        for (const s of sortedScores) {
          if (s.actionScore >= 95) { current++; maxStreak = Math.max(maxStreak, current); }
          else { current = 0; }
        }

        return { id: cycle.id, name: cycle.name, startDate: cycle.startDate, endDate: cycle.endDate, isActive: cycle.isActive, avgScore, avgTrajectory, topStreak: maxStreak, totalDays: inRange.length };
      });

      setCycleStats(stats);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [session]);

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
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Cycle Performance</h2>
      <div className="space-y-3">
        {cycleStats.map(cycle => (
          <Link key={cycle.id} href="/cycles">
            <div className={`rounded-xl border p-4 transition-colors hover:shadow-sm cursor-pointer ${
              cycle.isActive
                ? "border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-900"
                : "border-zinc-200 dark:border-zinc-700"
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{cycle.name}</h3>
                  {cycle.isActive && (
                    <span className="text-[10px] px-1.5 py-px rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Active</span>
                  )}
                </div>
                {(() => {
                  const start = new Date(cycle.startDate + "T00:00:00");
                  const end = new Date(cycle.endDate + "T00:00:00");
                  const now = new Date(new Date().toISOString().split("T")[0] + "T00:00:00");
                  const elapsed = Math.max(0, Math.ceil((Math.min(now.getTime(), end.getTime()) - start.getTime()) / 86400000));
                  const total = Math.ceil((end.getTime() - start.getTime()) / 86400000);
                  const remaining = Math.max(0, total - elapsed);
                  return <span className="text-xs text-zinc-400">{elapsed}/{total}d {remaining > 0 ? `· ${remaining} left` : "· done"}</span>;
                })()}
              </div>
              {cycle.totalDays > 0 ? (
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-xl font-bold text-zinc-900 dark:text-white">{cycle.avgScore}%</span>
                    <span className="text-[10px] text-zinc-400 ml-1">avg</span>
                  </div>
                  {cycle.avgTrajectory !== null && (
                    <div>
                      <span className={`text-xl font-bold ${cycle.avgTrajectory >= 1.0 ? "text-purple-500" : "text-red-500"}`}>
                        {cycle.avgTrajectory.toFixed(1)}x
                      </span>
                      <span className="text-[10px] text-zinc-400 ml-1">trajectory</span>
                    </div>
                  )}
                  {cycle.topStreak > 0 && (
                    <div className="flex items-center gap-1">
                      <FaFire className="text-amber-500 text-sm" />
                      <span className="text-xl font-bold text-amber-500">{cycle.topStreak}</span>
                      <span className="text-[10px] text-zinc-400">best streak</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-zinc-400">No data yet</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
