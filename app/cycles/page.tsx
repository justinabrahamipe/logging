"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaPlus,
  FaCheck,
  FaArrowLeft,
  FaTrash,
  FaEdit,
  FaChevronDown,
  FaChevronUp,
} from "react-icons/fa";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getCurrentWeekNumber, getGoalStatus, getTotalWeeks } from "@/lib/cycle-scoring";
import { computeCycleAnalytics } from "@/lib/cycle-analytics";
import { DEMO_CYCLES } from "@/lib/demo-data";
import type { Cycle, CycleGoal, LinkedTask, CycleDetail } from "@/lib/types";
import CyclesLoading from "./loading";

export default function CyclesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<CycleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Accordion state for cycle list
  const [futureAccordionOpen, setFutureAccordionOpen] = useState(false);
  const [pastAccordionOpen, setPastAccordionOpen] = useState(false);

  // Inline editing for vision/theme
  const [editingVision, setEditingVision] = useState(false);
  const [editingTheme, setEditingTheme] = useState(false);
  const [visionDraft, setVisionDraft] = useState("");
  const [themeDraft, setThemeDraft] = useState("");

  // Inline editing for cycle name/dates
  const [editingCycleName, setEditingCycleName] = useState(false);
  const [editingCycleDates, setEditingCycleDates] = useState(false);
  const [cycleNameDraft, setCycleNameDraft] = useState("");
  const [cycleStartDraft, setCycleStartDraft] = useState("");
  const [cycleEndDraft, setCycleEndDraft] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      setCycles(DEMO_CYCLES as Cycle[]);
      setLoading(false);
      return;
    }
    if (session?.user?.id) {
      fetchCycles();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status]);

  const fetchCycles = async () => {
    try {
      const res = await fetch("/api/cycles");
      if (res.ok) setCycles(await res.json());
    } catch (error) {
      console.error("Failed to fetch cycles:", error);
    } finally {
      setLoading(false);
    }
  };

  const [cycleScores, setCycleScores] = useState<{ date: string; actionScore: number; momentumScore: number | null; trajectoryScore: number | null }[]>([]);

  const fetchCycleDetail = async (id: number) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/cycles/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedCycle(data);
        // Fetch daily scores for this cycle's date range
        const daysDiff = Math.ceil((Date.now() - new Date(data.startDate).getTime()) / 86400000) + 1;
        const scoresRes = await fetch(`/api/daily-score/history?days=${Math.min(daysDiff, 365)}`);
        if (scoresRes.ok) {
          const scoresData = await scoresRes.json();
          setCycleScores(scoresData.scores || []);
        }
      }
    } catch (error) {
      console.error("Failed to fetch cycle detail:", error);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDeleteCycle = async (id: number) => {
    if (!confirm("Delete this cycle? This will remove all goals and data.")) return;
    try {
      await fetch(`/api/cycles/${id}`, { method: "DELETE" });
      setSelectedCycle(null);
      await fetchCycles();
    } catch (error) {
      console.error("Failed to delete cycle:", error);
    }
  };


  const handleSaveCycleField = async (updates: Record<string, string | boolean>) => {
    if (!selectedCycle) return;
    try {
      const res = await fetch(`/api/cycles/${selectedCycle.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedCycle({ ...selectedCycle, ...updated });
        // Also update in the cycles list
        setCycles(prev => prev.map(c => c.id === selectedCycle.id ? { ...c, ...updated } : c));
      }
    } catch (error) {
      console.error("Failed to save cycle:", error);
    }
  };

  const handleSaveVisionTheme = async (field: "vision" | "theme", value: string) => {
    if (!selectedCycle) return;
    try {
      const res = await fetch(`/api/cycles/${selectedCycle.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        setSelectedCycle({ ...selectedCycle, [field]: value || null });
      }
    } catch (error) {
      console.error("Failed to save:", error);
    }
  };

  const totalWeeks = selectedCycle ? getTotalWeeks(selectedCycle.startDate, selectedCycle.endDate) : 12;
  const currentWeek = selectedCycle ? getCurrentWeekNumber(selectedCycle.startDate, selectedCycle.endDate) : 1;

  // Analytics
  const analytics = useMemo(() => {
    if (!selectedCycle || selectedCycle.goals.length === 0) return null;
    return computeCycleAnalytics(selectedCycle.goals, currentWeek, totalWeeks);
  }, [selectedCycle, currentWeek, totalWeeks]);

  // Cycle score stats
  const cycleStats = useMemo(() => {
    if (!selectedCycle || cycleScores.length === 0) return null;
    // Filter scores within cycle date range
    const inRange = cycleScores.filter(s => s.date >= selectedCycle.startDate && s.date <= selectedCycle.endDate);
    if (inRange.length === 0) return null;

    // Average action score
    const avgScore = Math.round(inRange.reduce((s, d) => s + d.actionScore, 0) / inRange.length);

    // Average trajectory
    const trajScores = inRange.filter(s => s.trajectoryScore != null);
    const avgTrajectory = trajScores.length > 0
      ? Math.round(trajScores.reduce((s, d) => s + (d.trajectoryScore || 0), 0) / trajScores.length) / 100
      : null;

    // Streaks (consecutive days with actionScore >= 95)
    const sorted = [...inRange].sort((a, b) => a.date.localeCompare(b.date));
    const streaks: number[] = [];
    let current = 0;
    for (const s of sorted) {
      if (s.actionScore >= 95) {
        current++;
      } else {
        if (current > 0) streaks.push(current);
        current = 0;
      }
    }
    if (current > 0) streaks.push(current);
    const topStreaks = streaks.sort((a, b) => b - a).slice(0, 3);

    return { avgScore, avgTrajectory, topStreaks, totalDays: inRange.length };
  }, [selectedCycle, cycleScores]);

  if (loading || loadingDetail) return <CyclesLoading />;

  // === CYCLE DETAIL VIEW ===
  if (selectedCycle) {
    return (
      <div className="container mx-auto px-4 py-4 md:py-8 max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <motion.button
              onClick={() => setSelectedCycle(null)}
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <FaArrowLeft />
            </motion.button>
            <div className="flex-1">
              {editingCycleName ? (
                <input
                  autoFocus
                  value={cycleNameDraft}
                  onChange={(e) => setCycleNameDraft(e.target.value)}
                  onBlur={() => {
                    setEditingCycleName(false);
                    if (cycleNameDraft.trim()) handleSaveCycleField({ name: cycleNameDraft.trim() });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { setEditingCycleName(false); if (cycleNameDraft.trim()) handleSaveCycleField({ name: cycleNameDraft.trim() }); }
                    if (e.key === "Escape") setEditingCycleName(false);
                  }}
                  className="text-2xl md:text-3xl font-bold border-b-2 border-zinc-400 bg-transparent text-zinc-900 dark:text-white outline-none w-full"
                />
              ) : (
                <h1
                  onClick={() => { setEditingCycleName(true); setCycleNameDraft(selectedCycle.name); }}
                  className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                >
                  {selectedCycle.name}
                </h1>
              )}
              {editingCycleDates ? (
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <div>
                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">Start</label>
                    <input
                      type="date"
                      value={cycleStartDraft}
                      onChange={(e) => setCycleStartDraft(e.target.value)}
                      className="px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">End</label>
                    <input
                      type="date"
                      value={cycleEndDraft}
                      onChange={(e) => setCycleEndDraft(e.target.value)}
                      className="px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div className="flex gap-1.5 self-end">
                    <button
                      onClick={() => {
                        setEditingCycleDates(false);
                        if (cycleStartDraft && cycleEndDraft) handleSaveCycleField({ startDate: cycleStartDraft, endDate: cycleEndDraft });
                      }}
                      className="px-3 py-1.5 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 flex items-center gap-1"
                    >
                      <FaCheck className="text-xs" /> Save
                    </button>
                    <button
                      onClick={() => setEditingCycleDates(false)}
                      className="px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p
                  onClick={() => { setEditingCycleDates(true); setCycleStartDraft(selectedCycle.startDate); setCycleEndDraft(selectedCycle.endDate); }}
                  className="text-sm text-zinc-500 dark:text-zinc-400 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors flex items-center gap-1.5"
                >
                  {selectedCycle.startDate} &rarr; {selectedCycle.endDate} &middot; Week {currentWeek}/{totalWeeks}
                  <FaEdit className="text-[10px]" />
                </p>
              )}
            </div>
            <motion.button
              onClick={() => handleDeleteCycle(selectedCycle.id)}
              className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <FaTrash />
            </motion.button>
          </div>

          {/* Vision & Theme */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wide">Vision</label>
              {editingVision ? (
                <textarea
                  autoFocus
                  value={visionDraft}
                  onChange={(e) => setVisionDraft(e.target.value)}
                  onBlur={() => {
                    setEditingVision(false);
                    handleSaveVisionTheme("vision", visionDraft);
                  }}
                  onKeyDown={(e) => { if (e.key === "Escape") setEditingVision(false); }}
                  className="w-full px-2 py-1 text-sm border border-zinc-400 rounded bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white resize-none"
                  rows={2}
                />
              ) : (
                <p
                  onClick={() => { setEditingVision(true); setVisionDraft(selectedCycle.vision || ""); }}
                  className="text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700/50 rounded px-2 py-1 min-h-[2rem]"
                >
                  {selectedCycle.vision || <span className="text-zinc-400 italic">Click to add vision...</span>}
                </p>
              )}
            </div>
            <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wide">Theme</label>
              {editingTheme ? (
                <input
                  autoFocus
                  value={themeDraft}
                  onChange={(e) => setThemeDraft(e.target.value)}
                  onBlur={() => {
                    setEditingTheme(false);
                    handleSaveVisionTheme("theme", themeDraft);
                  }}
                  onKeyDown={(e) => { if (e.key === "Escape") setEditingTheme(false); if (e.key === "Enter") { setEditingTheme(false); handleSaveVisionTheme("theme", themeDraft); } }}
                  className="w-full px-2 py-1 text-sm border border-zinc-400 rounded bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                />
              ) : (
                <p
                  onClick={() => { setEditingTheme(true); setThemeDraft(selectedCycle.theme || ""); }}
                  className="text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700/50 rounded px-2 py-1 min-h-[2rem]"
                >
                  {selectedCycle.theme || <span className="text-zinc-400 italic">Click to add theme...</span>}
                </p>
              )}
            </div>
          </div>

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
            <div className="space-y-3 mb-6">
              {selectedCycle.goals.map((goal) => {
                const progress = goal.targetValue > 0 ? (goal.currentValue / goal.targetValue) * 100 : 0;
                const goalStatus = getGoalStatus(goal.currentValue, goal.targetValue, currentWeek - 1, totalWeeks);
                const statusColor = goalStatus === "Ahead" ? "text-green-500" : goalStatus === "Behind" ? "text-red-500" : "text-zinc-500";
                return (
                  <motion.div
                    key={goal.id}
                    layout
                    className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-zinc-900 dark:text-white">{goal.name}</h3>
                          <span className={`text-xs font-medium ${statusColor}`}>{goalStatus}</span>
                          {goal.goalType && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 capitalize">
                              {goal.goalType}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          {goal.currentValue} / {goal.targetValue} {goal.unit}
                        </p>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-3 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(progress, 100)}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100"
                      />
                    </div>
                    <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      <span>0</span>
                      <span>{Math.round(progress)}%</span>
                      <span>{goal.targetValue} {goal.unit}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Analytics Dashboard */}
          {analytics && (
            <>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Analytics</h2>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {/* Overall Completion */}
                <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wide">Completion</p>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white">{Math.round(analytics.overallCompletion)}%</p>
                  <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100 transition-all"
                      style={{ width: `${Math.min(analytics.overallCompletion, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Pace */}
                <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wide">Pace</p>
                  <p className={`text-2xl font-bold ${
                    analytics.pace === "ahead" ? "text-green-500" : analytics.pace === "behind" ? "text-red-500" : "text-zinc-500"
                  }`}>
                    {analytics.pace === "ahead" ? "Ahead" : analytics.pace === "behind" ? "Behind" : "On Track"}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">Projected: {Math.round(analytics.projectedCompletion)}%</p>
                </div>
              </div>
            </>
          )}

          {/* Cycle Score Stats */}
          {cycleStats && (
            <>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Cycle Performance</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wide">Avg Action Score</p>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white">{cycleStats.avgScore}%</p>
                  <p className="text-xs text-zinc-400 mt-1">{cycleStats.totalDays} days tracked</p>
                </div>
                {cycleStats.avgTrajectory !== null && (
                  <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wide">Avg Trajectory</p>
                    <p className={`text-2xl font-bold ${cycleStats.avgTrajectory >= 1.0 ? "text-purple-500" : "text-red-500"}`}>
                      {cycleStats.avgTrajectory.toFixed(1)}x
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">{cycleStats.avgTrajectory >= 1.0 ? "On pace" : "Behind"}</p>
                  </div>
                )}
                <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 col-span-2">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wide">Top Streaks</p>
                  {cycleStats.topStreaks.length > 0 ? (
                    <div className="flex items-baseline gap-3 mt-1">
                      {cycleStats.topStreaks.map((streak, i) => (
                        <div key={i} className="flex items-baseline gap-1">
                          <span className={`font-bold ${i === 0 ? "text-2xl text-amber-500" : i === 1 ? "text-xl text-zinc-500 dark:text-zinc-400" : "text-lg text-zinc-400 dark:text-zinc-500"}`}>
                            {streak}
                          </span>
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
          )}

          {/* Linked Tasks */}
          {selectedCycle.linkedTasks && selectedCycle.linkedTasks.length > 0 && (
            <>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Linked Tasks</h2>
              <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden mb-6">
                <div className="divide-y divide-zinc-100 dark:divide-zinc-700">
                  {selectedCycle.linkedTasks.map((task) => {
                    return (
                      <div key={task.id} className="px-4 py-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-zinc-900 dark:text-white">{task.name}</span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 ml-2 capitalize">{task.completionType}</span>
                        </div>
                        {task.frequency !== 'daily' && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                            {task.frequency === 'adhoc' ? 'One-time' :
                             task.frequency === 'monthly' ? 'Monthly' :
                             task.frequency === 'custom' ? 'Weekly' :
                             task.frequency === 'interval' ? 'Repeat' :
                             task.frequency}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

        </motion.div>

      </div>
    );
  }

  // === CYCLE LIST VIEW ===
  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white">Goal Cycles</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Plan and execute goal cycles of any duration</p>
          </div>
        </div>

        {/* Cycles list */}
        {cycles.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
            <p className="text-lg mb-2">No cycles yet</p>
            <p className="text-sm">Create your first goal cycle to start planning</p>
          </div>
        ) : (() => {
          const now = new Date();
          const activeCycles = cycles.filter((c) => {
            const end = new Date(c.endDate + "T23:59:59");
            const start = new Date(c.startDate + "T00:00:00");
            return c.isActive && now >= start && now <= end;
          });
          const futureCycles = cycles.filter((c) => {
            const start = new Date(c.startDate + "T00:00:00");
            return start > now;
          });
          const pastCycles = cycles.filter((c) => {
            const end = new Date(c.endDate + "T23:59:59");
            const start = new Date(c.startDate + "T00:00:00");
            return now > end || (!c.isActive && now >= start && now <= end);
          });

          const renderCycleCard = (cycle: Cycle, status: "Active" | "Future" | "Past") => {
            const cycleTotalWeeks = getTotalWeeks(cycle.startDate, cycle.endDate);
            const weekNum = getCurrentWeekNumber(cycle.startDate, cycle.endDate);
            const isCompleted = status === "Past";

            return (
              <motion.div
                key={cycle.id}
                layout
                onClick={() => fetchCycleDetail(cycle.id)}
                className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5 cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{cycle.name}</h3>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    status === "Active"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : status === "Future"
                      ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
                  }`}>
                    {status}
                  </span>
                </div>
                {cycle.theme && (
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-1 font-medium">{cycle.theme}</p>
                )}
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                  {cycle.startDate} &rarr; {cycle.endDate}
                </p>
                <div className="flex gap-1">
                  {Array.from({ length: cycleTotalWeeks }, (_, i) => (
                    <div
                      key={i}
                      className={`h-2 flex-1 rounded-full ${
                        i + 1 < weekNum
                          ? "bg-zinc-900 dark:bg-zinc-100"
                          : i + 1 === weekNum && !isCompleted
                          ? "bg-zinc-400 dark:bg-zinc-500"
                          : isCompleted
                          ? "bg-zinc-900 dark:bg-zinc-100"
                          : "bg-zinc-200 dark:bg-zinc-700"
                      }`}
                    />
                  ))}
                </div>
                {status === "Active" && (
                  <p className="text-xs text-zinc-400 mt-1">Week {weekNum} of {cycleTotalWeeks}</p>
                )}
              </motion.div>
            );
          };

          return (
            <div className="space-y-4">
              {/* Active cycles */}
              {activeCycles.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activeCycles.map((c) => renderCycleCard(c, "Active"))}
                </div>
              )}

              {/* Future cycles accordion */}
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
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                          {futureCycles.map((c) => renderCycleCard(c, "Future"))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Past cycles accordion */}
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
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                          {pastCycles.map((c) => renderCycleCard(c, "Past"))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          );
        })()}
      </motion.div>

      {/* Floating New Cycle button */}
      <button
        onClick={() => router.push("/cycles/new")}
        className="fixed bottom-20 md:bottom-14 right-4 md:right-8 z-40 w-12 h-12 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-lg flex items-center justify-center hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
      >
        <FaPlus className="text-lg" />
      </button>
    </div>
  );
}
