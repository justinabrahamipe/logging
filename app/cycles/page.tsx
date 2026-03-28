"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPlus, FaChevronDown, FaChevronUp, FaFire } from "react-icons/fa";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getCurrentWeekNumber, getTotalWeeks } from "@/lib/cycle-scoring";
import { DEMO_CYCLES } from "@/lib/demo-data";
import { getProgressColor } from "@/lib/scoring";
import type { Cycle } from "@/lib/types";
import CyclesLoading from "./loading";
import { useTheme } from "@/components/ThemeProvider";

export default function CyclesPage() {
  const { data: session, status } = useSession();
  const { streakThreshold } = useTheme();
  const router = useRouter();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [futureAccordionOpen, setFutureAccordionOpen] = useState(false);
  const [pastAccordionOpen, setPastAccordionOpen] = useState(false);
  const [goals, setGoals] = useState<{ id: number; periodId: number | null; name: string; goalType: string; status?: string }[]>([]);
  const [scores, setScores] = useState<{ date: string; actionScore: number }[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      setCycles(DEMO_CYCLES as Cycle[]);
      setLoading(false);
      return;
    }
    if (session?.user?.id) {
      Promise.all([
        fetch("/api/cycles").then(r => r.ok ? r.json() : []),
        fetch("/api/outcomes").then(r => r.ok ? r.json() : []),
        fetch("/api/daily-score/history?days=365").then(r => r.ok ? r.json() : { scores: [] }),
      ]).then(([cyclesData, goalsData, historyData]) => {
        setCycles(cyclesData);
        setGoals(goalsData);
        setScores(historyData.scores || []);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status]);

  if (loading) return <CyclesLoading />;

  const now = new Date();
  const activeCycles = cycles.filter((c) => {
    const end = new Date(c.endDate + "T23:59:59");
    const start = new Date(c.startDate + "T00:00:00");
    return c.isActive && now >= start && now <= end;
  });
  const futureCycles = cycles.filter((c) => new Date(c.startDate + "T00:00:00") > now);
  const pastCycles = cycles.filter((c) => {
    const end = new Date(c.endDate + "T23:59:59");
    const start = new Date(c.startDate + "T00:00:00");
    return now > end || (!c.isActive && now >= start && now <= end);
  });

  const renderCycleCard = (cycle: Cycle, cycleStatus: "Active" | "Future" | "Past") => {
    const cycleTotalWeeks = getTotalWeeks(cycle.startDate, cycle.endDate);
    const weekNum = getCurrentWeekNumber(cycle.startDate, cycle.endDate);
    const isCompleted = cycleStatus === "Past";

    // Gist stats
    const cycleGoals = goals.filter(g => g.periodId === cycle.id);
    const completedGoals = cycleGoals.filter(g => g.status === "completed").length;
    const inRange = scores.filter(s => s.date >= cycle.startDate && s.date <= cycle.endDate);
    const avgScore = inRange.length > 0 ? Math.round(inRange.reduce((s, d) => s + d.actionScore, 0) / inRange.length) : null;
    let topStreak = 0;
    if (inRange.length > 0) {
      const sorted = [...inRange].sort((a, b) => a.date.localeCompare(b.date));
      let cur = 0;
      for (const s of sorted) {
        if (s.actionScore >= streakThreshold) { cur++; topStreak = Math.max(topStreak, cur); } else { cur = 0; }
      }
    }

    // Day-based progress
    const startMs = new Date(cycle.startDate + 'T00:00:00').getTime();
    const endMs = new Date(cycle.endDate + 'T23:59:59').getTime();
    const nowMs = now.getTime();
    const totalDays = Math.max(1, Math.round((endMs - startMs) / 86400000));
    const elapsedDays = cycleStatus === "Future" ? 0 : cycleStatus === "Past" ? totalDays : Math.max(0, Math.min(totalDays, Math.round((nowMs - startMs) / 86400000)));
    const remainingDays = totalDays - elapsedDays;
    const progressPct = Math.round((elapsedDays / totalDays) * 100);

    return (
      <motion.div
        key={cycle.id}
        layout
        onClick={() => status === "authenticated" && router.push(`/cycles/${cycle.id}`)}
        className="relative overflow-hidden bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5 cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors"
      >
        {/* Background progress fill */}
        {progressPct > 0 && (
          <div
            className="absolute inset-0 pointer-events-none bg-blue-500 dark:bg-blue-400 opacity-[0.06] dark:opacity-[0.08]"
            style={{ width: `${progressPct}%` }}
          />
        )}

        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{cycle.name}</h3>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              cycleStatus === "Active"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : cycleStatus === "Future"
                ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
            }`}>
              {cycleStatus}
            </span>
          </div>
          {cycle.theme && (
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-1 font-medium">{cycle.theme}</p>
          )}
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
            {cycle.startDate} &rarr; {cycle.endDate}
          </p>

          {/* Stats gist */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-zinc-500 dark:text-zinc-400">
              {elapsedDays} day{elapsedDays !== 1 ? 's' : ''} done
            </span>
            <span className="text-zinc-500 dark:text-zinc-400">
              {remainingDays} day{remainingDays !== 1 ? 's' : ''} left
            </span>
            {cycleStatus === "Active" && (
              <span className="font-medium text-zinc-600 dark:text-zinc-300">
                Week {weekNum}/{cycleTotalWeeks}
              </span>
            )}
            {cycleGoals.length > 0 && (
              <span className="text-zinc-500 dark:text-zinc-400">
                {completedGoals}/{cycleGoals.length} goals
              </span>
            )}
            {avgScore !== null && (
              <span className="font-semibold text-zinc-900 dark:text-white">{avgScore}% avg</span>
            )}
            {topStreak > 0 && (
              <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-medium">
                <FaFire className="text-[10px]" /> {topStreak}
              </span>
            )}
          </div>

          {/* Week segments colored by avg score */}
          <div className="flex gap-1 mt-3">
            {Array.from({ length: cycleTotalWeeks }, (_, i) => {
              const weekStart = new Date(cycle.startDate + 'T00:00:00');
              weekStart.setDate(weekStart.getDate() + i * 7);
              const weekEnd = new Date(weekStart);
              weekEnd.setDate(weekEnd.getDate() + 6);
              const ws = weekStart.toISOString().split('T')[0];
              const we = weekEnd.toISOString().split('T')[0];

              const weekScores = scores.filter(s => s.date >= ws && s.date <= we && s.date >= cycle.startDate && s.date <= cycle.endDate);
              const isPast = i + 1 < weekNum || isCompleted;
              const isCurrent = i + 1 === weekNum && !isCompleted;

              if (!isPast && !isCurrent) {
                return <div key={i} className="h-2 flex-1 rounded-full bg-zinc-200 dark:bg-zinc-700" />;
              }

              if (weekScores.length === 0) {
                return <div key={i} className={`h-2 flex-1 rounded-full ${isCurrent ? 'bg-zinc-300 dark:bg-zinc-600' : 'bg-zinc-200 dark:bg-zinc-700'}`} />;
              }

              const avg = Math.round(weekScores.reduce((s, d) => s + d.actionScore, 0) / weekScores.length);
              const color = getProgressColor(avg);

              return (
                <div
                  key={i}
                  className={`h-2 flex-1 rounded-full ${isCurrent ? 'opacity-70' : ''}`}
                  style={{ backgroundColor: color }}
                  title={`Week ${i + 1}: ${avg}%`}
                />
              );
            })}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="px-3 py-4 md:px-6 md:py-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white">Goal Cycles</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Plan and execute goal cycles of any duration</p>
          </div>
        </div>

        {cycles.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
            <p className="text-lg mb-2">No cycles yet</p>
            <p className="text-sm">Create your first goal cycle to start planning</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeCycles.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeCycles.map((c) => renderCycleCard(c, "Active"))}
              </div>
            )}

            {futureCycles.length > 0 && (
              <div>
                <button
                  onClick={() => setFutureAccordionOpen(!futureAccordionOpen)}
                  className="flex items-center justify-between w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-700 dark:text-zinc-300 font-medium text-sm"
                >
                  <span>Future ({futureCycles.length})</span>
                  {futureAccordionOpen ? <FaChevronUp /> : <FaChevronDown />}
                </button>
                <AnimatePresence>
                  {futureAccordionOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                        {futureCycles.map((c) => renderCycleCard(c, "Future"))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {pastCycles.length > 0 && (
              <div>
                <button
                  onClick={() => setPastAccordionOpen(!pastAccordionOpen)}
                  className="flex items-center justify-between w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-400 font-medium text-sm"
                >
                  <span>Past ({pastCycles.length})</span>
                  {pastAccordionOpen ? <FaChevronUp /> : <FaChevronDown />}
                </button>
                <AnimatePresence>
                  {pastAccordionOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                        {pastCycles.map((c) => renderCycleCard(c, "Past"))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}
      </motion.div>

      <button
        onClick={() => router.push("/cycles/new")}
        className="fixed bottom-20 md:bottom-14 right-4 md:right-8 z-40 w-12 h-12 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-lg flex items-center justify-center hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
      >
        <FaPlus className="text-lg" />
      </button>
    </div>
  );
}
