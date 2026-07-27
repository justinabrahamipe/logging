"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaCheck,
  FaArrowLeft,
  FaTrash,
  FaEdit,
} from "react-icons/fa";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { getCurrentWeekNumber, getGoalStatus, getTotalWeeks } from "@/lib/cycle-scoring";
import { computeCycleAnalytics } from "@/lib/cycle-analytics";
import { getGoalBadge } from "@/lib/goal-badge";
import { parseScheduleDays } from "@/lib/format";
import type { CycleDetail } from "@/lib/types";
import { useTheme } from "@/components/ThemeProvider";

export default function CycleDetailPage() {
  const { data: session, status } = useSession();
  const { streakThreshold } = useTheme();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [selectedCycle, setSelectedCycle] = useState<CycleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cycleScores, setCycleScores] = useState<{ date: string; actionScore: number; trajectoryScore: number | null }[]>([]);
  const [completionDates, setCompletionDates] = useState<Record<number, { date: string; value: number; completed: boolean }[]>>({});

  // Inline editing
  const [editingVision, setEditingVision] = useState(false);
  const [editingTheme, setEditingTheme] = useState(false);
  const [visionDraft, setVisionDraft] = useState("");
  const [themeDraft, setThemeDraft] = useState("");
  const [editingCycleName, setEditingCycleName] = useState(false);
  const [editingCycleDates, setEditingCycleDates] = useState(false);
  const [cycleNameDraft, setCycleNameDraft] = useState("");
  const [cycleStartDraft, setCycleStartDraft] = useState("");
  const [cycleEndDraft, setCycleEndDraft] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") { setLoading(false); return; }
    if (!session?.user?.id) { setLoading(false); return; }
    fetch(`/api/cycles/${id}`).then(r => r.ok ? r.json() : null).then(data => {
      if (data) {
        setSelectedCycle(data);
        const daysDiff = Math.ceil((Date.now() - new Date(data.startDate).getTime()) / 86400000) + 1;
        fetch(`/api/daily-score/history?days=${Math.min(daysDiff, 365)}`).then(r => r.ok ? r.json() : { scores: [] }).then(s => setCycleScores(s.scores || []));
        fetch("/api/goals/completions").then(r => r.ok ? r.json() : {}).then(c => setCompletionDates(c));
      }
      setLoading(false);
    });
  }, [session, status, id]);

  const totalWeeks = selectedCycle ? getTotalWeeks(selectedCycle.startDate, selectedCycle.endDate) : 12;
  const currentWeek = selectedCycle ? getCurrentWeekNumber(selectedCycle.startDate, selectedCycle.endDate) : 1;

  // Compute momentum & trajectory first so analytics can use them
  const goalMetrics = useMemo(() => {
    if (!selectedCycle) return { avgMomentum: null as number | null, avgTrajectory: null as number | null };

    const todayStr = new Date().toISOString().split("T")[0];

    // Compute badges using shared getGoalBadge for consistent calculation
    const targetValues: number[] = [];
    const outcomeValues: number[] = [];
    for (const g of selectedCycle.goals) {
      const badge = getGoalBadge({
        id: g.id,
        goalType: g.goalType,
        startValue: g.startValue || 0,
        targetValue: g.targetValue,
        currentValue: g.currentValue,
        startDate: g.startDate ?? selectedCycle.startDate,
        targetDate: g.targetDate ?? selectedCycle.endDate,
        scheduleDays: g.scheduleDays ?? null,
        flexibilityRule: g.flexibilityRule ?? undefined,
      }, todayStr);
      if (!badge) continue;
      if (g.goalType === 'target') targetValues.push(badge.value);
      else if (g.goalType === 'outcome') outcomeValues.push(badge.value);
    }

    const avgMomentum = targetValues.length > 0
      ? Math.round(targetValues.reduce((s, v) => s + v, 0) / targetValues.length * 10) / 10
      : null;
    const avgTrajectory = outcomeValues.length > 0
      ? Math.round(outcomeValues.reduce((s, v) => s + v, 0) / outcomeValues.length * 10) / 10
      : null;

    return { avgMomentum, avgTrajectory };
  }, [selectedCycle]);

  const analytics = useMemo(() => {
    if (!selectedCycle || selectedCycle.goals.length === 0) return null;
    const goalsWithAdherence = selectedCycle.goals.map(g => {
      if (g.goalType !== "habitual") return g;
      const entries = completionDates[g.id] || [];
      const sched: number[] = parseScheduleDays(g.scheduleDays);
      const cycleStart = selectedCycle.startDate;
      const cycleEnd = selectedCycle.endDate;
      const todayStr = new Date().toISOString().split("T")[0];
      const effectiveEnd = cycleEnd < todayStr ? cycleEnd : todayStr;

      let expectedSoFar = 0;
      let totalExpected = 0;
      const d = new Date(cycleStart + "T00:00:00");
      const endD = new Date(cycleEnd + "T00:00:00");
      const effectiveEndD = new Date(effectiveEnd + "T00:00:00");
      while (d <= endD) {
        if (sched.length === 0 || sched.includes(d.getDay())) {
          totalExpected++;
          if (d <= effectiveEndD) expectedSoFar++;
        }
        d.setDate(d.getDate() + 1);
      }

      const completedCount = new Set(
        entries.filter(e => e.completed && e.date >= cycleStart && e.date <= effectiveEnd).map(e => e.date)
      ).size;

      const adherence = expectedSoFar > 0 ? Math.round((Math.min(completedCount, expectedSoFar) / expectedSoFar) * 100) : null;
      const remainingDays = totalExpected - expectedSoFar;
      const maxPossible = totalExpected > 0 ? Math.round(((completedCount + remainingDays) / totalExpected) * 100) : null;

      return { ...g, adherence, maxPossible };
    });
    return computeCycleAnalytics(goalsWithAdherence, currentWeek, totalWeeks, goalMetrics.avgMomentum, goalMetrics.avgTrajectory);
  }, [selectedCycle, currentWeek, totalWeeks, completionDates, goalMetrics]);

  const cycleStats = useMemo(() => {
    if (!selectedCycle || cycleScores.length === 0) return null;
    const inRange = cycleScores.filter(s => s.date >= selectedCycle.startDate && s.date <= selectedCycle.endDate);
    if (inRange.length === 0) return null;
    const avgScore = Math.round(inRange.reduce((s, d) => s + d.actionScore, 0) / inRange.length);

    const sorted = [...inRange].sort((a, b) => a.date.localeCompare(b.date));
    const streaks: number[] = [];
    let cur = 0;
    for (const s of sorted) {
      if (s.actionScore >= streakThreshold) { cur++; } else { if (cur > 0) streaks.push(cur); cur = 0; }
    }
    if (cur > 0) streaks.push(cur);
    const topStreaks = streaks.sort((a, b) => b - a).slice(0, 3);
    return { avgScore, topStreaks, totalDays: inRange.length };
  }, [selectedCycle, cycleScores, streakThreshold]);

  const handleSaveCycleField = async (updates: Record<string, string | boolean>) => {
    if (!selectedCycle) return;
    const res = await fetch(`/api/cycles/${selectedCycle.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
    if (res.ok) { const updated = await res.json(); setSelectedCycle({ ...selectedCycle, ...updated }); }
  };

  const handleSaveVisionTheme = async (field: "vision" | "theme", value: string) => {
    if (!selectedCycle) return;
    const res = await fetch(`/api/cycles/${selectedCycle.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }) });
    if (res.ok) setSelectedCycle({ ...selectedCycle, [field]: value || null });
  };

  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const handleDeleteCycle = () => {
    setConfirmDialog({
      message: "Delete this cycle? This action cannot be undone.",
      onConfirm: async () => {
        setConfirmDialog(null);
        await fetch(`/api/cycles/${id}`, { method: "DELETE" });
        router.push("/cycles");
      },
    });
  };

  if (loading) return (
    <div className="px-3 py-4 md:px-6 md:py-6 animate-pulse">
      <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-700 rounded mb-4" />
      <div className="h-64 bg-zinc-200 dark:bg-zinc-700 rounded-xl" />
    </div>
  );

  if (!selectedCycle) return (
    <div className="px-3 py-4 md:px-6 md:py-6 text-center py-12">
      <p className="text-zinc-500 dark:text-zinc-400">Sign in to view cycle details.</p>
      <button onClick={() => router.push("/cycles")} className="mt-3 px-4 py-2 text-sm bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg">Back to Cycles</button>
    </div>
  );

  return (
    <div className="px-3 py-4 md:px-6 md:py-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push("/cycles")} className="p-2 rounded-lg text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <FaArrowLeft />
          </button>
          <div className="flex-1">
            {editingCycleName ? (
              <input
                autoFocus
                value={cycleNameDraft}
                onChange={(e) => setCycleNameDraft(e.target.value)}
                onBlur={() => { setEditingCycleName(false); if (cycleNameDraft.trim()) handleSaveCycleField({ name: cycleNameDraft.trim() }); }}
                onKeyDown={(e) => { if (e.key === "Enter") { setEditingCycleName(false); if (cycleNameDraft.trim()) handleSaveCycleField({ name: cycleNameDraft.trim() }); } if (e.key === "Escape") setEditingCycleName(false); }}
                className="text-2xl md:text-3xl font-bold border-b-2 border-zinc-400 bg-transparent text-zinc-900 dark:text-white outline-none w-full"
              />
            ) : (
              <h1 onClick={() => { setEditingCycleName(true); setCycleNameDraft(selectedCycle.name); }} className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                {selectedCycle.name}
              </h1>
            )}
            {editingCycleDates ? (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <div>
                  <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">Start</label>
                  <input type="date" value={cycleStartDraft} onChange={(e) => setCycleStartDraft(e.target.value)} className="px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">End</label>
                  <input type="date" value={cycleEndDraft} onChange={(e) => setCycleEndDraft(e.target.value)} className="px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white" />
                </div>
                <div className="flex gap-1.5 self-end">
                  <button onClick={() => { setEditingCycleDates(false); if (cycleStartDraft && cycleEndDraft) handleSaveCycleField({ startDate: cycleStartDraft, endDate: cycleEndDraft }); }} className="px-3 py-1.5 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 flex items-center gap-1">
                    <FaCheck className="text-xs" /> Save
                  </button>
                  <button onClick={() => setEditingCycleDates(false)} className="px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancel</button>
                </div>
              </div>
            ) : (
              <p onClick={() => { setEditingCycleDates(true); setCycleStartDraft(selectedCycle.startDate); setCycleEndDraft(selectedCycle.endDate); }} className="text-sm text-zinc-500 dark:text-zinc-400 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors flex items-center gap-1.5">
                {selectedCycle.startDate} &rarr; {selectedCycle.endDate} &middot; Week {currentWeek}/{totalWeeks}
                <FaEdit className="text-[10px]" />
              </p>
            )}
          </div>
          <button onClick={handleDeleteCycle} className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
            <FaTrash />
          </button>
        </div>

        {/* Vision & Theme */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wide">Vision</label>
            {editingVision ? (
              <textarea autoFocus value={visionDraft} onChange={(e) => setVisionDraft(e.target.value)} onBlur={() => { setEditingVision(false); handleSaveVisionTheme("vision", visionDraft); }} onKeyDown={(e) => { if (e.key === "Escape") setEditingVision(false); }} className="w-full px-2 py-1 text-sm border border-zinc-400 rounded bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white resize-none" rows={2} />
            ) : (
              <p onClick={() => { setEditingVision(true); setVisionDraft(selectedCycle.vision || ""); }} className="text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700/50 rounded px-2 py-1 min-h-[2rem]">
                {selectedCycle.vision || <span className="text-zinc-400 italic">Click to add vision...</span>}
              </p>
            )}
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wide">Theme</label>
            {editingTheme ? (
              <input autoFocus value={themeDraft} onChange={(e) => setThemeDraft(e.target.value)} onBlur={() => { setEditingTheme(false); handleSaveVisionTheme("theme", themeDraft); }} onKeyDown={(e) => { if (e.key === "Escape") setEditingTheme(false); if (e.key === "Enter") { setEditingTheme(false); handleSaveVisionTheme("theme", themeDraft); } }} className="w-full px-2 py-1 text-sm border border-zinc-400 rounded bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white" />
            ) : (
              <p onClick={() => { setEditingTheme(true); setThemeDraft(selectedCycle.theme || ""); }} className="text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700/50 rounded px-2 py-1 min-h-[2rem]">
                {selectedCycle.theme || <span className="text-zinc-400 italic">Click to add theme...</span>}
              </p>
            )}
          </div>
        </div>

        {/* Analytics */}
        {analytics && (
          <>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Analytics</h2>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wide">Completion</p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-white">{Math.round(analytics.overallCompletion)}%</p>
                <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full mt-2 overflow-hidden">
                  <div className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100 transition-all" style={{ width: `${Math.min(analytics.overallCompletion, 100)}%` }} />
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wide">Pace</p>
                <p className={`text-2xl font-bold ${analytics.pace === "ahead" ? "text-green-500" : analytics.pace === "behind" ? "text-red-500" : "text-zinc-500"}`}>
                  {analytics.pace === "ahead" ? "Ahead" : analytics.pace === "behind" ? "Behind" : "On Track"}
                  <span className="text-sm font-normal text-zinc-400 ml-1">{analytics.paceScore.toFixed(2)}x</span>
                </p>
                <p className="text-xs text-zinc-400 mt-1">Best possible: {Math.round(analytics.projectedCompletion)}%</p>
              </div>
            </div>
          </>
        )}

        {/* Cycle Performance */}
        {cycleStats && (() => {
          const todayStr = new Date().toISOString().split("T")[0];
          const start = new Date(selectedCycle.startDate + "T00:00:00");
          const end = new Date(selectedCycle.endDate + "T00:00:00");
          const today = new Date(todayStr + "T00:00:00");
          const elapsed = Math.max(0, Math.ceil((Math.min(today.getTime(), end.getTime()) - start.getTime()) / 86400000));
          const totalDays = Math.ceil((end.getTime() - start.getTime()) / 86400000);
          const remaining = Math.max(0, totalDays - elapsed);
          return (
          <>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Cycle Performance</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
              <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wide">Days</p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-white">{elapsed}<span className="text-sm font-normal text-zinc-400">/{totalDays}</span></p>
                <p className="text-xs text-zinc-400 mt-1">{remaining > 0 ? `${remaining} remaining` : "Completed"}</p>
              </div>
              <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wide">Avg Action Score</p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-white">{cycleStats.avgScore}%</p>
                <p className="text-xs text-zinc-400 mt-1">{cycleStats.totalDays} days tracked</p>
              </div>
              {goalMetrics.avgMomentum !== null && (
                <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wide">Momentum</p>
                  <p className={`text-2xl font-bold ${goalMetrics.avgMomentum >= 1.0 ? "text-blue-500" : "text-red-500"}`}>{goalMetrics.avgMomentum.toFixed(1)}x</p>
                  <p className="text-xs text-zinc-400 mt-1">{goalMetrics.avgMomentum >= 1.0 ? "On track" : "Behind"}</p>
                </div>
              )}
              {goalMetrics.avgTrajectory !== null && (
                <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wide">Trajectory</p>
                  <p className={`text-2xl font-bold ${goalMetrics.avgTrajectory >= 1.0 ? "text-purple-500" : "text-red-500"}`}>{goalMetrics.avgTrajectory.toFixed(1)}x</p>
                  <p className="text-xs text-zinc-400 mt-1">{goalMetrics.avgTrajectory >= 1.0 ? "On pace" : "Behind"}</p>
                </div>
              )}
              <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 col-span-2">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wide">Top Streaks</p>
                {cycleStats.topStreaks.length > 0 ? (
                  <div className="flex items-baseline gap-3 mt-1">
                    {cycleStats.topStreaks.map((streak, i) => (
                      <div key={i} className="flex items-baseline gap-1">
                        <span className={`font-bold ${i === 0 ? "text-2xl text-amber-500" : i === 1 ? "text-xl text-zinc-500 dark:text-zinc-400" : "text-lg text-zinc-400 dark:text-zinc-500"}`}>{streak}</span>
                        <span className="text-xs text-zinc-400">days</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400 mt-1">No streaks yet (need 95%+ days)</p>
                )}
              </div>
            </div>
          </>
          );
        })()}

        {/* Goals */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Goals</h2>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">Assign goals via the Goals page</p>
        </div>

        {selectedCycle.goals.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 mb-6">
            <p className="mb-1">No goals yet</p>
            <p className="text-sm">Add your first goal to start tracking</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {selectedCycle.goals.map((goal) => {
              const start = goal.startValue || 0;
              const range = goal.targetValue - start;
              const progress = range !== 0 ? ((goal.currentValue - start) / range) * 100 : (goal.currentValue >= goal.targetValue ? 100 : 0);
              const clampedProgress = Math.max(0, Math.min(progress, 100));
              const goalStatus = getGoalStatus(goal.currentValue, goal.targetValue, currentWeek - 1, totalWeeks);
              const statusColor = goalStatus === "Ahead" ? "text-green-500" : goalStatus === "Behind" ? "text-red-500" : "text-zinc-500";
              const color = goal.pillarColor || "#3B82F6";
              const isHabitual = goal.goalType === "habitual";

              // Adherence + streak for habitual goals
              let adherence: number | null = null;
              let streak = 0;
              if (isHabitual && selectedCycle.startDate) {
                const entries = completionDates[goal.id] || [];
                const sched: number[] = parseScheduleDays(goal.scheduleDays);
                const cycleStart = selectedCycle.startDate;
                const todayStr = new Date().toISOString().split("T")[0];
                const cycleEnd = selectedCycle.endDate < todayStr ? selectedCycle.endDate : todayStr;
                let expected = 0;
                const d = new Date(cycleStart + "T00:00:00");
                const endD = new Date(cycleEnd + "T00:00:00");
                while (d <= endD) {
                  if (sched.length === 0 || sched.includes(d.getDay())) expected++;
                  d.setDate(d.getDate() + 1);
                }
                const completedDates = new Set(entries.filter(e => e.completed && e.date >= cycleStart && e.date <= cycleEnd).map(e => e.date));
                adherence = expected > 0 ? Math.round((Math.min(completedDates.size, expected) / expected) * 100) : null;

                // Streak: count backwards from today/cycleEnd
                const sd = new Date(cycleEnd + "T12:00:00");
                if (!completedDates.has(cycleEnd)) sd.setDate(sd.getDate() - 1);
                while (sd >= new Date(cycleStart + "T12:00:00")) {
                  const dateStr = sd.toISOString().split("T")[0];
                  if (sched.length > 0 && !sched.includes(sd.getDay())) { sd.setDate(sd.getDate() - 1); continue; }
                  if (completedDates.has(dateStr)) { streak++; sd.setDate(sd.getDate() - 1); } else { break; }
                }
              }

              return (
                <motion.div
                  key={goal.id}
                  layout
                  onClick={() => router.push(`/goals/${goal.id}`)}
                  className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 cursor-pointer hover:shadow transition-shadow"
                  style={{ borderLeftWidth: 4, borderLeftColor: color }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-zinc-900 dark:text-white truncate">{goal.name}</h3>
                    <span className="text-[11px] px-1.5 py-px rounded-full font-medium bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400 shrink-0 capitalize">
                      {goal.goalType}
                    </span>
                    {goal.status === "completed" && (
                      <span className="text-[10px] px-1.5 py-px rounded-full font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 shrink-0">Completed</span>
                    )}
                    {goal.status === "abandoned" && (
                      <span className="text-[10px] px-1.5 py-px rounded-full font-medium bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 shrink-0">Abandoned</span>
                    )}
                    <span className={`text-xs font-medium shrink-0 ${statusColor}`}>{goalStatus}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-zinc-500 dark:text-zinc-400 mb-2">
                    {goal.pillarName && (
                      <span className="text-xs" style={{ color }}>{goal.pillarEmoji} {goal.pillarName}</span>
                    )}
                    {isHabitual ? (
                      <>
                        {goal.dailyTarget ? (
                          <span>{goal.dailyTarget} {goal.unit}/session</span>
                        ) : goal.unit ? (
                          <span>{goal.unit}</span>
                        ) : null}
                        {adherence !== null && (
                          <span className={`font-medium ${
                            adherence >= 95 ? "text-green-600 dark:text-green-400" :
                            adherence >= 75 ? "text-emerald-600 dark:text-emerald-400" :
                            adherence >= 50 ? "text-amber-600 dark:text-amber-400" :
                            adherence >= 25 ? "text-orange-600 dark:text-orange-400" :
                            "text-red-600 dark:text-red-400"
                          }`}>
                            {adherence}%
                          </span>
                        )}
                        {streak > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 font-medium">
                            {streak}🔥
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <span>{goal.currentValue} / {goal.targetValue} {goal.unit}</span>
                        <span className="font-medium">{Math.round(progress)}%</span>
                      </>
                    )}
                  </div>
                  {!isHabitual && (
                    <div className="w-full h-2.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${clampedProgress}%` }} transition={{ duration: 0.8, ease: "easeOut" }} className="h-full rounded-full" style={{ backgroundColor: color }} />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

      </motion.div>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {confirmDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setConfirmDialog(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-800 rounded-xl p-6 mx-4 max-w-sm w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-4">{confirmDialog.message}</p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="px-4 py-2 text-sm rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
