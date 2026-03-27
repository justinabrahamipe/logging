"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { FaArrowLeft, FaEdit, FaFire } from "react-icons/fa";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { formatDate } from "@/lib/format";
import { useTheme } from "@/components/ThemeProvider";

interface Pillar {
  id: number;
  name: string;
  emoji: string;
  color: string;
  weight: number;
  description: string | null;
}

interface Goal {
  id: number;
  name: string;
  goalType: string;
  status: string;
  startValue: number;
  targetValue: number;
  currentValue: number;
  unit: string;
  startDate: string | null;
  targetDate: string | null;
  periodId: number | null;
  pillarId: number | null;
  dailyTarget: number | null;
  pillarName: string | null;
  pillarColor: string | null;
}

interface CycleInfo {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

interface ScoreEntry {
  date: string;
  actionScore: number;
  pillarScores: string | null;
  trajectoryScore: number | null;
}

interface CyclePerf {
  cycle: CycleInfo;
  goals: Goal[];
  avgPillarScore: number | null;
  avgActionScore: number;
  topStreak: number;
  totalDays: number;
}

export default function PillarDetailPage() {
  const { data: session, status } = useSession();
  const { dateFormat, streakThreshold } = useTheme();
  const router = useRouter();
  const params = useParams();
  const id = parseInt(params.id as string);

  const [pillar, setPillar] = useState<Pillar | null>(null);
  const [allGoals, setAllGoals] = useState<Goal[]>([]);
  const [cycles, setCycles] = useState<CycleInfo[]>([]);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") { setLoading(false); return; }
    if (!session?.user?.id) { setLoading(false); return; }

    Promise.all([
      fetch(`/api/pillars/${id}`).then(r => r.ok ? r.json() : null),
      fetch("/api/outcomes").then(r => r.ok ? r.json() : []),
      fetch("/api/cycles").then(r => r.ok ? r.json() : []),
      fetch("/api/daily-score/history?days=365").then(r => r.ok ? r.json() : { scores: [] }),
    ]).then(([pillarData, goalsData, cyclesData, historyData]) => {
      setPillar(pillarData);
      setAllGoals(goalsData.filter((g: Goal) => g.pillarId === id));
      setCycles(cyclesData);
      setScores(historyData.scores || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status, id]);

  // Goals not in any cycle
  const unlinkedGoals = useMemo(() => allGoals.filter(g => !g.periodId), [allGoals]);

  // Performance per cycle
  const cyclePerformance = useMemo((): CyclePerf[] => {
    if (!pillar) return [];
    // Only cycles that have goals for this pillar
    const relevantCycleIds = new Set(allGoals.filter(g => g.periodId).map(g => g.periodId!));
    return cycles
      .filter(c => relevantCycleIds.has(c.id))
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
      .map(cycle => {
        const cycleGoals = allGoals.filter(g => g.periodId === cycle.id);
        const inRange = scores.filter(s => s.date >= cycle.startDate && s.date <= cycle.endDate);

        // Pillar-specific score from pillarScores JSON
        let avgPillarScore: number | null = null;
        const pillarScoreValues: number[] = [];
        for (const s of inRange) {
          if (s.pillarScores) {
            try {
              const ps = JSON.parse(s.pillarScores);
              if (ps[id] != null) pillarScoreValues.push(ps[id]);
            } catch { /* ignore */ }
          }
        }
        if (pillarScoreValues.length > 0) {
          avgPillarScore = Math.round(pillarScoreValues.reduce((a, b) => a + b, 0) / pillarScoreValues.length);
        }

        const avgActionScore = inRange.length > 0 ? Math.round(inRange.reduce((s, d) => s + d.actionScore, 0) / inRange.length) : 0;

        // Streak based on pillar score >= 95 (or action score if no pillar data)
        const sorted = [...inRange].sort((a, b) => a.date.localeCompare(b.date));
        let maxStreak = 0, cur = 0;
        for (const s of sorted) {
          const score = pillarScoreValues.length > 0 ? (() => { try { const ps = JSON.parse(s.pillarScores || "{}"); return ps[id] ?? 0; } catch { return 0; } })() : s.actionScore;
          if (score >= streakThreshold) { cur++; maxStreak = Math.max(maxStreak, cur); } else { cur = 0; }
        }

        return { cycle, goals: cycleGoals, avgPillarScore, avgActionScore, topStreak: maxStreak, totalDays: inRange.length };
      });
  }, [pillar, allGoals, cycles, scores, id]);

  if (loading) return (
    <div className="px-3 py-4 md:px-6 md:py-6 animate-pulse">
      <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-700 rounded mb-4" />
      <div className="h-64 bg-zinc-200 dark:bg-zinc-700 rounded-xl" />
    </div>
  );

  if (!pillar) return (
    <div className="px-3 py-4 md:px-6 md:py-6 text-center py-12">
      <p className="text-zinc-500 dark:text-zinc-400">Sign in to view pillar details.</p>
      <button onClick={() => router.push("/pillars")} className="mt-3 px-4 py-2 text-sm bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg">Back to Pillars</button>
    </div>
  );

  const color = pillar.color;

  return (
    <div className="px-3 py-4 md:px-6 md:py-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push("/pillars")} className="p-2 rounded-lg text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <FaArrowLeft />
          </button>
          <span className="text-3xl">{pillar.emoji}</span>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white">{pillar.name}</h1>
            {pillar.description && <p className="text-sm text-zinc-500 dark:text-zinc-400">{pillar.description}</p>}
          </div>
          <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Weight: {pillar.weight}%</span>
          <button onClick={() => router.push(`/pillars/${pillar.id}/edit`)} className="p-2 rounded-lg text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700">
            <FaEdit />
          </button>
        </div>

        {/* Cycle Performance */}
        {cyclePerformance.length > 0 && (
          <>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Cycle Performance</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
              {cyclePerformance.map(({ cycle, goals, avgPillarScore, avgActionScore, topStreak, totalDays }) => (
                <div
                  key={cycle.id}
                  onClick={() => router.push(`/cycles/${cycle.id}`)}
                  className={`bg-white dark:bg-zinc-800 rounded-xl border p-4 cursor-pointer hover:shadow-sm transition-shadow ${
                    cycle.isActive ? "border-zinc-900 dark:border-zinc-100" : "border-zinc-200 dark:border-zinc-700"
                  }`}
                  style={{ borderLeftWidth: 4, borderLeftColor: color }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{cycle.name}</h3>
                    {cycle.isActive && (
                      <span className="text-[10px] px-1.5 py-px rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Active</span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mb-3">
                    {formatDate(cycle.startDate, dateFormat)} — {formatDate(cycle.endDate, dateFormat)}
                  </p>

                  {totalDays > 0 ? (
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      {avgPillarScore !== null && (
                        <div>
                          <span className="text-xl font-bold" style={{ color }}>{avgPillarScore}%</span>
                          <span className="text-[10px] text-zinc-400 ml-1">pillar avg</span>
                        </div>
                      )}
                      <div>
                        <span className="text-xl font-bold text-zinc-900 dark:text-white">{avgActionScore}%</span>
                        <span className="text-[10px] text-zinc-400 ml-1">action avg</span>
                      </div>
                      {topStreak > 0 && (
                        <div className="flex items-center gap-1">
                          <FaFire className="text-amber-500 text-sm" />
                          <span className="text-xl font-bold text-amber-500">{topStreak}</span>
                          <span className="text-[10px] text-zinc-400">streak</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-400 mb-3">No data yet</p>
                  )}

                  {/* Goals in this cycle */}
                  <div className="space-y-1">
                    {goals.map(g => {
                      const progress = g.targetValue > 0 ? Math.round(((g.currentValue - g.startValue) / (g.targetValue - g.startValue)) * 100) : 0;
                      return (
                        <div key={g.id} className="flex items-center justify-between text-xs">
                          <span className="text-zinc-700 dark:text-zinc-300 truncate">{g.name}</span>
                          <span className={`font-medium shrink-0 ml-2 ${g.status === "completed" ? "text-green-600" : g.status === "abandoned" ? "text-red-500" : "text-zinc-500"}`}>
                            {g.status === "completed" ? "Done" : g.status === "abandoned" ? "Dropped" : `${Math.max(0, Math.min(progress, 100))}%`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Unlinked Goals */}
        {unlinkedGoals.length > 0 && (
          <>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Goals (No Cycle)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
              {unlinkedGoals.map(g => {
                const progress = g.targetValue > 0 ? ((g.currentValue - g.startValue) / (g.targetValue - g.startValue)) * 100 : 0;
                return (
                  <motion.div
                    key={g.id}
                    onClick={() => router.push(`/goals/${g.id}`)}
                    className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 cursor-pointer hover:shadow transition-shadow"
                    style={{ borderLeftWidth: 4, borderLeftColor: color }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-zinc-900 dark:text-white truncate">{g.name}</h3>
                      <span className="text-[11px] px-1.5 py-px rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400 shrink-0 capitalize">{g.goalType}</span>
                      {g.status === "completed" && <span className="text-[10px] px-1.5 py-px rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 shrink-0">Completed</span>}
                      {g.status === "abandoned" && <span className="text-[10px] px-1.5 py-px rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 shrink-0">Abandoned</span>}
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
                      {g.currentValue} / {g.targetValue} {g.unit}
                    </p>
                    {g.goalType !== "habitual" && (
                      <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(progress, 100))}%`, backgroundColor: color }} />
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </>
        )}

        {allGoals.length === 0 && (
          <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
            <p>No goals linked to this pillar</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
