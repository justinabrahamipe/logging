"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaPlus,
  FaTimes,
  FaCheck,
  FaArrowLeft,
  FaTrash,
  FaEdit,
  FaEllipsisV,
  FaChevronDown,
  FaChevronUp,
  FaLink,
  FaSyncAlt,
} from "react-icons/fa";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getCurrentWeekNumber, getGoalStatus, getTotalWeeks, calculateEndDate } from "@/lib/twelve-week-scoring";
import { computeCycleAnalytics } from "@/lib/twelve-week-analytics";

interface Cycle {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  vision: string | null;
  theme: string | null;
  isActive: boolean;
  createdAt: string;
}

interface Tactic {
  id: number;
  goalId: number;
  periodId: number;
  name: string;
  description: string | null;
  isCompleted: boolean;
  sortOrder: number;
}

interface Goal {
  id: number;
  periodId: number;
  name: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  linkedOutcomeId: number | null;
  outcomeName: string | null;
  tactics: Tactic[];
}

interface WeeklyTarget {
  id: number;
  goalId: number;
  periodId: number;
  weekNumber: number;
  targetValue: number;
  actualValue: number;
  isOverridden: boolean;
  score: string | null;
  reviewedAt: string | null;
}

interface WeeklyReview {
  id: number;
  periodId: number;
  weekNumber: number;
  notes: string | null;
  wins: string | null;
  blockers: string | null;
}

interface LinkedTask {
  id: number;
  name: string;
  completionType: string;
  importance: string;
  frequency: string;
  isActive: boolean;
}

interface CycleDetail extends Cycle {
  goals: Goal[];
  weeklyTargets: WeeklyTarget[];
  weeklyReviews: WeeklyReview[];
  linkedTasks: LinkedTask[];
}

interface Outcome {
  id: number;
  name: string;
}

export default function TwelveWeekYearPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<CycleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCycleForm, setShowCycleForm] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [expandedGoal, setExpandedGoal] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [savingWeek, setSavingWeek] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [newTacticName, setNewTacticName] = useState("");

  const [cycleForm, setCycleForm] = useState({ name: "", startDate: "", endDate: "", vision: "", theme: "" });
  const [goalForm, setGoalForm] = useState({ name: "", targetValue: "", unit: "", linkedOutcomeId: "" });
  const [weekEdits, setWeekEdits] = useState<Record<string, { actualValue: string; targetValue: string; isOverridden: boolean }>>({});
  const [reviewEdits, setReviewEdits] = useState<Record<number, { notes: string; wins: string; blockers: string }>>({});

  // Accordion state for cycle list
  const [futureAccordionOpen, setFutureAccordionOpen] = useState(false);
  const [pastAccordionOpen, setPastAccordionOpen] = useState(false);

  // Inline editing for vision/theme
  const [editingVision, setEditingVision] = useState(false);
  const [editingTheme, setEditingTheme] = useState(false);
  const [visionDraft, setVisionDraft] = useState("");
  const [themeDraft, setThemeDraft] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (session?.user?.id) {
      fetchCycles();
      fetchOutcomes();
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

  const fetchCycleDetail = async (id: number) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/cycles/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedCycle(data);
      }
    } catch (error) {
      console.error("Failed to fetch cycle detail:", error);
    } finally {
      setLoadingDetail(false);
    }
  };

  const fetchOutcomes = async () => {
    try {
      const res = await fetch("/api/outcomes");
      if (res.ok) {
        const data = await res.json();
        setOutcomes(data.map((o: { id: number; name: string }) => ({ id: o.id, name: o.name })));
      }
    } catch (error) {
      console.error("Failed to fetch outcomes:", error);
    }
  };

  const handleCreateCycle = async () => {
    if (!cycleForm.name.trim() || !cycleForm.startDate) return;
    try {
      const res = await fetch("/api/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cycleForm.name,
          startDate: cycleForm.startDate,
          endDate: cycleForm.endDate || null,
          vision: cycleForm.vision || null,
          theme: cycleForm.theme || null,
        }),
      });
      if (res.ok) {
        await fetchCycles();
        setShowCycleForm(false);
        setCycleForm({ name: "", startDate: "", endDate: "", vision: "", theme: "" });
      }
    } catch (error) {
      console.error("Failed to create cycle:", error);
    }
  };

  const handleDeleteCycle = async (id: number) => {
    if (!confirm("Delete this cycle? This will remove all goals and weekly data.")) return;
    try {
      await fetch(`/api/cycles/${id}`, { method: "DELETE" });
      setSelectedCycle(null);
      await fetchCycles();
    } catch (error) {
      console.error("Failed to delete cycle:", error);
    }
  };

  const handleCreateGoal = async () => {
    if (!selectedCycle || !goalForm.name.trim() || !goalForm.targetValue || !goalForm.unit.trim()) return;
    try {
      const res = await fetch(`/api/cycles/${selectedCycle.id}/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: goalForm.name,
          targetValue: parseFloat(goalForm.targetValue),
          unit: goalForm.unit,
          linkedOutcomeId: goalForm.linkedOutcomeId ? parseInt(goalForm.linkedOutcomeId) : null,
        }),
      });
      if (res.ok) {
        await fetchCycleDetail(selectedCycle.id);
        setShowGoalForm(false);
        setGoalForm({ name: "", targetValue: "", unit: "", linkedOutcomeId: "" });
      }
    } catch (error) {
      console.error("Failed to create goal:", error);
    }
  };

  const handleUpdateGoal = async () => {
    if (!selectedCycle || !editingGoal) return;
    try {
      const res = await fetch(`/api/cycles/${selectedCycle.id}/goals/${editingGoal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: goalForm.name,
          targetValue: parseFloat(goalForm.targetValue),
          unit: goalForm.unit,
          linkedOutcomeId: goalForm.linkedOutcomeId ? parseInt(goalForm.linkedOutcomeId) : null,
        }),
      });
      if (res.ok) {
        await fetchCycleDetail(selectedCycle.id);
        setEditingGoal(null);
        setShowGoalForm(false);
        setGoalForm({ name: "", targetValue: "", unit: "", linkedOutcomeId: "" });
      }
    } catch (error) {
      console.error("Failed to update goal:", error);
    }
  };

  const handleDeleteGoal = async (goalId: number) => {
    if (!selectedCycle || !confirm("Delete this goal and all its weekly data?")) return;
    try {
      await fetch(`/api/cycles/${selectedCycle.id}/goals/${goalId}`, { method: "DELETE" });
      await fetchCycleDetail(selectedCycle.id);
    } catch (error) {
      console.error("Failed to delete goal:", error);
    }
    setMenuOpen(null);
  };

  const startEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setGoalForm({
      name: goal.name,
      targetValue: String(goal.targetValue),
      unit: goal.unit,
      linkedOutcomeId: goal.linkedOutcomeId ? String(goal.linkedOutcomeId) : "",
    });
    setShowGoalForm(true);
    setMenuOpen(null);
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

  // Tactics handlers
  const handleAddTactic = async (goalId: number) => {
    if (!selectedCycle || !newTacticName.trim()) return;
    try {
      const res = await fetch(`/api/cycles/${selectedCycle.id}/goals/${goalId}/tactics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTacticName.trim() }),
      });
      if (res.ok) {
        setNewTacticName("");
        await fetchCycleDetail(selectedCycle.id);
      }
    } catch (error) {
      console.error("Failed to add tactic:", error);
    }
  };

  const handleToggleTactic = async (goalId: number, tacticId: number, isCompleted: boolean) => {
    if (!selectedCycle) return;
    try {
      await fetch(`/api/cycles/${selectedCycle.id}/goals/${goalId}/tactics`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tacticId, isCompleted: !isCompleted }),
      });
      await fetchCycleDetail(selectedCycle.id);
    } catch (error) {
      console.error("Failed to toggle tactic:", error);
    }
  };

  const handleDeleteTactic = async (goalId: number, tacticId: number) => {
    if (!selectedCycle) return;
    try {
      await fetch(`/api/cycles/${selectedCycle.id}/goals/${goalId}/tactics?tacticId=${tacticId}`, {
        method: "DELETE",
      });
      await fetchCycleDetail(selectedCycle.id);
    } catch (error) {
      console.error("Failed to delete tactic:", error);
    }
  };

  const initWeekEdits = (weekNum: number) => {
    if (!selectedCycle) return;
    const edits: Record<string, { actualValue: string; targetValue: string; isOverridden: boolean }> = {};
    for (const goal of selectedCycle.goals) {
      const target = selectedCycle.weeklyTargets.find(
        (t) => t.goalId === goal.id && t.weekNumber === weekNum
      );
      edits[`${goal.id}`] = {
        actualValue: String(target?.actualValue ?? 0),
        targetValue: String(target?.targetValue ?? (goal.targetValue / totalWeeks)),
        isOverridden: target?.isOverridden ?? false,
      };
    }
    setWeekEdits(edits);

    // Load existing review data
    const existingReview = selectedCycle.weeklyReviews?.find((r) => r.weekNumber === weekNum);
    setReviewEdits((prev) => ({
      ...prev,
      [weekNum]: {
        notes: existingReview?.notes || "",
        wins: existingReview?.wins || "",
        blockers: existingReview?.blockers || "",
      },
    }));
  };

  const handleSaveWeekReview = async (weekNum: number) => {
    if (!selectedCycle) return;
    setSavingWeek(true);
    try {
      const updates = Object.entries(weekEdits).map(([goalId, vals]) => ({
        goalId: parseInt(goalId),
        weekNumber: weekNum,
        actualValue: parseFloat(vals.actualValue) || 0,
        ...(vals.isOverridden ? { targetValue: parseFloat(vals.targetValue) || 0 } : {}),
        isOverridden: vals.isOverridden,
      }));

      const reviewData = reviewEdits[weekNum];
      const review = reviewData ? {
        weekNumber: weekNum,
        notes: reviewData.notes,
        wins: reviewData.wins,
        blockers: reviewData.blockers,
      } : undefined;

      await fetch(`/api/cycles/${selectedCycle.id}/weekly`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates, review }),
      });

      await fetchCycleDetail(selectedCycle.id);
    } catch (error) {
      console.error("Failed to save review:", error);
    } finally {
      setSavingWeek(false);
    }
  };

  const getScoreColor = (score: string | null) => {
    switch (score) {
      case "exceeded": return "text-green-500 bg-green-100 dark:bg-green-900/30";
      case "good": return "text-blue-500 bg-blue-100 dark:bg-blue-900/30";
      case "partial": return "text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30";
      case "missed": return "text-red-500 bg-red-100 dark:bg-red-900/30";
      default: return "text-gray-400 bg-gray-100 dark:bg-gray-700";
    }
  };

  const getScoreIcon = (score: string | null) => {
    switch (score) {
      case "exceeded": return "\u2605";
      case "good": return "\u2713";
      case "partial": return "\u25D0";
      case "missed": return "\u2717";
      default: return "\u00B7";
    }
  };

  const totalWeeks = selectedCycle ? getTotalWeeks(selectedCycle.startDate, selectedCycle.endDate) : 12;
  const currentWeek = selectedCycle ? getCurrentWeekNumber(selectedCycle.startDate, selectedCycle.endDate) : 1;

  // Analytics
  const analytics = useMemo(() => {
    if (!selectedCycle || selectedCycle.goals.length === 0) return null;
    return computeCycleAnalytics(selectedCycle.goals, selectedCycle.weeklyTargets, currentWeek, totalWeeks);
  }, [selectedCycle, currentWeek, totalWeeks]);

  if (loading || loadingDetail) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // === CYCLE DETAIL VIEW ===
  if (selectedCycle) {
    return (
      <div className="container mx-auto px-4 py-4 md:py-8 max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedCycle(null)}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <FaArrowLeft />
            </motion.button>
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{selectedCycle.name}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {selectedCycle.startDate} &rarr; {selectedCycle.endDate} &middot; Week {currentWeek}/{totalWeeks}
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleDeleteCycle(selectedCycle.id)}
              className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <FaTrash />
            </motion.button>
          </div>

          {/* Vision & Theme */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Vision</label>
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
                  className="w-full px-2 py-1 text-sm border border-blue-400 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  rows={2}
                />
              ) : (
                <p
                  onClick={() => { setEditingVision(true); setVisionDraft(selectedCycle.vision || ""); }}
                  className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded px-2 py-1 min-h-[2rem]"
                >
                  {selectedCycle.vision || <span className="text-gray-400 italic">Click to add vision...</span>}
                </p>
              )}
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Theme</label>
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
                  className="w-full px-2 py-1 text-sm border border-blue-400 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              ) : (
                <p
                  onClick={() => { setEditingTheme(true); setThemeDraft(selectedCycle.theme || ""); }}
                  className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded px-2 py-1 min-h-[2rem]"
                >
                  {selectedCycle.theme || <span className="text-gray-400 italic">Click to add theme...</span>}
                </p>
              )}
            </div>
          </div>

          {/* Goals */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Goals</h2>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setEditingGoal(null);
                setGoalForm({ name: "", targetValue: "", unit: "", linkedOutcomeId: "" });
                setShowGoalForm(true);
              }}
              className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-sm font-medium flex items-center gap-1.5"
            >
              <FaPlus className="text-xs" /> Add Goal
            </motion.button>
          </div>

          {selectedCycle.goals.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-6">
              <p className="mb-1">No goals yet</p>
              <p className="text-sm">Add your first goal to start tracking</p>
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              {selectedCycle.goals.map((goal) => {
                const progress = goal.targetValue > 0 ? (goal.currentValue / goal.targetValue) * 100 : 0;
                const goalStatus = getGoalStatus(goal.currentValue, goal.targetValue, currentWeek - 1, totalWeeks);
                const statusColor = goalStatus === "Ahead" ? "text-green-500" : goalStatus === "Behind" ? "text-red-500" : "text-blue-500";
                const isGoalExpanded = expandedGoal === goal.id;

                return (
                  <motion.div
                    key={goal.id}
                    layout
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{goal.name}</h3>
                          <span className={`text-xs font-medium ${statusColor}`}>{goalStatus}</span>
                          {goal.outcomeName && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 flex items-center gap-1">
                              <FaLink className="text-[10px]" /> {goal.outcomeName}
                            </span>
                          )}
                          {goal.linkedOutcomeId && (
                            <FaSyncAlt className="text-[10px] text-green-500" title="Synced to outcome" />
                          )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {goal.currentValue} / {goal.targetValue} {goal.unit}
                        </p>
                      </div>
                      <div className="relative flex items-center gap-1">
                        <button
                          onClick={() => setExpandedGoal(isGoalExpanded ? null : goal.id)}
                          className="p-2 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          title="Tactics"
                        >
                          {isGoalExpanded ? <FaChevronUp className="text-sm" /> : <FaChevronDown className="text-sm" />}
                        </button>
                        <button
                          onClick={() => setMenuOpen(menuOpen === goal.id ? null : goal.id)}
                          className="p-2 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          <FaEllipsisV className="text-sm" />
                        </button>
                        <AnimatePresence>
                          {menuOpen === goal.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="absolute right-0 top-8 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-20 overflow-hidden"
                            >
                              <button
                                onClick={() => startEditGoal(goal)}
                                className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                              >
                                <FaEdit /> Edit
                              </button>
                              <button
                                onClick={() => handleDeleteGoal(goal.id)}
                                className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                <FaTrash /> Delete
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(progress, 100)}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span>0</span>
                      <span>{Math.round(progress)}%</span>
                      <span>{goal.targetValue} {goal.unit}</span>
                    </div>

                    {/* Tactics (expandable) */}
                    <AnimatePresence>
                      {isGoalExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Tactics / Strategies</p>
                            {goal.tactics.length === 0 && (
                              <p className="text-xs text-gray-400 mb-2">No tactics yet</p>
                            )}
                            <div className="space-y-1.5 mb-2">
                              {goal.tactics.map((tactic) => (
                                <div key={tactic.id} className="flex items-center gap-2 group">
                                  <button
                                    onClick={() => handleToggleTactic(goal.id, tactic.id, tactic.isCompleted)}
                                    className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                                      tactic.isCompleted
                                        ? "bg-green-500 border-green-500 text-white"
                                        : "border-gray-300 dark:border-gray-600 hover:border-blue-400"
                                    }`}
                                  >
                                    {tactic.isCompleted && <FaCheck className="text-[10px]" />}
                                  </button>
                                  <span className={`text-sm flex-1 ${tactic.isCompleted ? "line-through text-gray-400" : "text-gray-700 dark:text-gray-300"}`}>
                                    {tactic.name}
                                  </span>
                                  <button
                                    onClick={() => handleDeleteTactic(goal.id, tactic.id)}
                                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 p-1 transition-opacity"
                                  >
                                    <FaTimes className="text-xs" />
                                  </button>
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={newTacticName}
                                onChange={(e) => setNewTacticName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleAddTactic(goal.id); }}
                                placeholder="Add tactic..."
                                className="flex-1 px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                              <button
                                onClick={() => handleAddTactic(goal.id)}
                                className="px-2.5 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                              >
                                <FaPlus className="text-xs" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Analytics Dashboard */}
          {analytics && (
            <>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Analytics</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {/* Overall Completion */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Completion</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{Math.round(analytics.overallCompletion)}%</p>
                  <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                      style={{ width: `${Math.min(analytics.overallCompletion, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Pace */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Pace</p>
                  <p className={`text-2xl font-bold ${
                    analytics.pace === "ahead" ? "text-green-500" : analytics.pace === "behind" ? "text-red-500" : "text-blue-500"
                  }`}>
                    {analytics.pace === "ahead" ? "Ahead" : analytics.pace === "behind" ? "Behind" : "On Track"}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Projected: {Math.round(analytics.projectedCompletion)}%</p>
                </div>

                {/* Consistent Weeks */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Consistent Weeks</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {analytics.consistentWeeks}/{analytics.totalReviewedWeeks}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {analytics.totalReviewedWeeks > 0
                      ? `${Math.round((analytics.consistentWeeks / analytics.totalReviewedWeeks) * 100)}% consistency`
                      : "No weeks reviewed yet"}
                  </p>
                </div>

                {/* Goal Trends */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Goal Trends</p>
                  <div className="space-y-2 mt-1">
                    {analytics.goalTrends.slice(0, 3).map((gt) => {
                      const maxVal = Math.max(...gt.weeklyActuals, 1);
                      return (
                        <div key={gt.goalId}>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{gt.goalName}</p>
                          <div className="flex gap-[2px] items-end h-4">
                            {gt.weeklyActuals.map((val, i) => (
                              <div
                                key={i}
                                className={`flex-1 rounded-sm ${i + 1 <= currentWeek ? "bg-blue-500" : "bg-gray-200 dark:bg-gray-700"}`}
                                style={{ height: `${Math.max((val / maxVal) * 100, 4)}%` }}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Linked Tasks */}
          {selectedCycle.linkedTasks && selectedCycle.linkedTasks.length > 0 && (
            <>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Linked Tasks</h2>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {selectedCycle.linkedTasks.map((task) => {
                    const badge = task.importance === 'high'
                      ? { label: 'High', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' }
                      : task.importance === 'medium'
                      ? { label: 'Med', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' }
                      : { label: 'Low', className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' };
                    return (
                      <div key={task.id} className="px-4 py-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{task.name}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 capitalize">{task.completionType}</span>
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${badge.className}`}>{badge.label}</span>
                        {task.frequency === 'adhoc' && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">Ad-hoc</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Weekly Breakdown Grid */}
          {selectedCycle.goals.length > 0 && (
            <>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Weekly Breakdown</h2>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
                {/* Grid header */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400 sticky left-0 bg-white dark:bg-gray-800">Goal</th>
                        {Array.from({ length: totalWeeks }, (_, i) => (
                          <th
                            key={i}
                            className={`px-2 py-3 text-center font-medium min-w-[40px] ${
                              i + 1 === currentWeek
                                ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
                                : "text-gray-500 dark:text-gray-400"
                            }`}
                          >
                            W{i + 1}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCycle.goals.map((goal) => (
                        <tr key={goal.id} className="border-b border-gray-100 dark:border-gray-700/50">
                          <td className="px-4 py-2 font-medium text-gray-700 dark:text-gray-300 sticky left-0 bg-white dark:bg-gray-800 truncate max-w-[150px]">
                            {goal.name}
                          </td>
                          {Array.from({ length: totalWeeks }, (_, i) => {
                            const target = selectedCycle.weeklyTargets.find(
                              (t) => t.goalId === goal.id && t.weekNumber === i + 1
                            );
                            return (
                              <td key={i} className="px-2 py-2 text-center">
                                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${getScoreColor(target?.score ?? null)}`}>
                                  {getScoreIcon(target?.score ?? null)}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Expandable Week Reviews */}
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Week Reviews</h2>
              <div className="space-y-2 mb-8">
                {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((weekNum) => {
                  const isExpanded = expandedWeek === weekNum;
                  const weekTargets = selectedCycle.weeklyTargets.filter((t) => t.weekNumber === weekNum);
                  const allReviewed = weekTargets.length > 0 && weekTargets.every((t) => t.score);
                  const someReviewed = weekTargets.some((t) => t.score);
                  const hasReviewNotes = selectedCycle.weeklyReviews?.some((r) => r.weekNumber === weekNum && (r.notes || r.wins || r.blockers));

                  return (
                    <div key={weekNum} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <button
                        onClick={() => {
                          if (isExpanded) {
                            setExpandedWeek(null);
                          } else {
                            setExpandedWeek(weekNum);
                            initWeekEdits(weekNum);
                          }
                        }}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`font-semibold ${weekNum === currentWeek ? "text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"}`}>
                            Week {weekNum}
                          </span>
                          {weekNum === currentWeek && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                              Current
                            </span>
                          )}
                          {allReviewed && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              Reviewed
                            </span>
                          )}
                          {!allReviewed && someReviewed && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                              Partial
                            </span>
                          )}
                          {hasReviewNotes && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                              Notes
                            </span>
                          )}
                        </div>
                        {isExpanded ? <FaChevronUp className="text-gray-400" /> : <FaChevronDown className="text-gray-400" />}
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 space-y-3 border-t border-gray-200 dark:border-gray-700 pt-3">
                              {selectedCycle.goals.map((goal) => {
                                const target = selectedCycle.weeklyTargets.find(
                                  (t) => t.goalId === goal.id && t.weekNumber === weekNum
                                );
                                const edit = weekEdits[`${goal.id}`];
                                if (!target || !edit) return null;

                                return (
                                  <div key={goal.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="font-medium text-gray-700 dark:text-gray-300">{goal.name}</span>
                                      {target.score && (
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getScoreColor(target.score)}`}>
                                          {target.score}
                                        </span>
                                      )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                          Target ({goal.unit})
                                        </label>
                                        <input
                                          type="number"
                                          step="any"
                                          value={edit.targetValue}
                                          onChange={(e) => setWeekEdits((prev) => ({
                                            ...prev,
                                            [`${goal.id}`]: { ...edit, targetValue: e.target.value },
                                          }))}
                                          disabled={!edit.isOverridden}
                                          className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                          Actual ({goal.unit})
                                        </label>
                                        <input
                                          type="number"
                                          step="any"
                                          value={edit.actualValue}
                                          onChange={(e) => setWeekEdits((prev) => ({
                                            ...prev,
                                            [`${goal.id}`]: { ...edit, actualValue: e.target.value },
                                          }))}
                                          className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        />
                                      </div>
                                    </div>
                                    <label className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={edit.isOverridden}
                                        onChange={(e) => setWeekEdits((prev) => ({
                                          ...prev,
                                          [`${goal.id}`]: { ...edit, isOverridden: e.target.checked },
                                        }))}
                                        className="rounded border-gray-300 dark:border-gray-600"
                                      />
                                      Override target
                                    </label>
                                  </div>
                                );
                              })}

                              {/* Weekly Review Notes */}
                              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-3">
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Weekly Review Notes</p>
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Wins</label>
                                  <textarea
                                    value={reviewEdits[weekNum]?.wins || ""}
                                    onChange={(e) => setReviewEdits((prev) => ({
                                      ...prev,
                                      [weekNum]: { ...prev[weekNum], wins: e.target.value },
                                    }))}
                                    placeholder="What went well this week?"
                                    rows={2}
                                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Blockers</label>
                                  <textarea
                                    value={reviewEdits[weekNum]?.blockers || ""}
                                    onChange={(e) => setReviewEdits((prev) => ({
                                      ...prev,
                                      [weekNum]: { ...prev[weekNum], blockers: e.target.value },
                                    }))}
                                    placeholder="What held you back?"
                                    rows={2}
                                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notes</label>
                                  <textarea
                                    value={reviewEdits[weekNum]?.notes || ""}
                                    onChange={(e) => setReviewEdits((prev) => ({
                                      ...prev,
                                      [weekNum]: { ...prev[weekNum], notes: e.target.value },
                                    }))}
                                    placeholder="Additional reflections..."
                                    rows={2}
                                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                                  />
                                </div>
                              </div>

                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleSaveWeekReview(weekNum)}
                                disabled={savingWeek}
                                className="w-full py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                              >
                                <FaCheck /> {savingWeek ? "Saving..." : "Save Review"}
                              </motion.button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </motion.div>

        {/* Goal Form Modal */}
        <AnimatePresence>
          {showGoalForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => { setShowGoalForm(false); setEditingGoal(null); }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {editingGoal ? "Edit Goal" : "New Goal"}
                  </h2>
                  <button onClick={() => { setShowGoalForm(false); setEditingGoal(null); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <FaTimes />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                    <input
                      type="text"
                      value={goalForm.name}
                      onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="e.g., LeetCode problems"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Value</label>
                      <input
                        type="number"
                        step="any"
                        value={goalForm.targetValue}
                        onChange={(e) => setGoalForm({ ...goalForm, targetValue: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="e.g., 60"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit</label>
                      <input
                        type="text"
                        value={goalForm.unit}
                        onChange={(e) => setGoalForm({ ...goalForm, unit: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="e.g., problems"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Link to Outcome (optional)</label>
                    <select
                      value={goalForm.linkedOutcomeId}
                      onChange={(e) => setGoalForm({ ...goalForm, linkedOutcomeId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">None</option>
                      {outcomes.map((o) => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={editingGoal ? handleUpdateGoal : handleCreateGoal}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                    >
                      <FaCheck /> {editingGoal ? "Update" : "Create"}
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { setShowGoalForm(false); setEditingGoal(null); }}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium"
                    >
                      Cancel
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
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
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">Goal Cycles</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Plan and execute goal cycles of any duration</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCycleForm(true)}
            className="p-2 md:px-4 md:py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium flex items-center gap-2"
          >
            <FaPlus /> <span className="hidden md:inline">New Cycle</span>
          </motion.button>
        </div>

        {/* Cycles list */}
        {cycles.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
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
                whileHover={{ scale: 1.01 }}
                onClick={() => fetchCycleDetail(cycle.id)}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-5 cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{cycle.name}</h3>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    status === "Active"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : status === "Future"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                  }`}>
                    {status}
                  </span>
                </div>
                {cycle.theme && (
                  <p className="text-xs text-purple-600 dark:text-purple-400 mb-1 font-medium">{cycle.theme}</p>
                )}
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  {cycle.startDate} &rarr; {cycle.endDate}
                </p>
                <div className="flex gap-1">
                  {Array.from({ length: cycleTotalWeeks }, (_, i) => (
                    <div
                      key={i}
                      className={`h-2 flex-1 rounded-full ${
                        i + 1 < weekNum
                          ? "bg-blue-500"
                          : i + 1 === weekNum && !isCompleted
                          ? "bg-blue-300 dark:bg-blue-600"
                          : isCompleted
                          ? "bg-blue-500"
                          : "bg-gray-200 dark:bg-gray-700"
                      }`}
                    />
                  ))}
                </div>
                {status === "Active" && (
                  <p className="text-xs text-gray-400 mt-1">Week {weekNum} of {cycleTotalWeeks}</p>
                )}
              </motion.div>
            );
          };

          return (
            <div className="space-y-4">
              {/* Active cycles */}
              {activeCycles.length > 0 && (
                <div className="space-y-3">
                  {activeCycles.map((c) => renderCycleCard(c, "Active"))}
                </div>
              )}

              {/* Future cycles accordion */}
              {futureCycles.length > 0 && (
                <div>
                  <button
                    onClick={() => setFutureAccordionOpen(!futureAccordionOpen)}
                    className="flex items-center justify-between w-full px-4 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-700 dark:text-blue-400 font-medium text-sm"
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
                        <div className="space-y-3 mt-3">
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
                    className="flex items-center justify-between w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-gray-600 dark:text-gray-400 font-medium text-sm"
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
                        <div className="space-y-3 mt-3">
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

      {/* New Cycle Modal */}
      <AnimatePresence>
        {showCycleForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCycleForm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">New Cycle</h2>
                <button onClick={() => setShowCycleForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <FaTimes />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                  <input
                    type="text"
                    value={cycleForm.name}
                    onChange={(e) => setCycleForm({ ...cycleForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g., Q1 2026 Transformation"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={cycleForm.startDate}
                      onChange={(e) => {
                        const start = e.target.value;
                        const autoEnd = start ? calculateEndDate(start) : "";
                        setCycleForm({ ...cycleForm, startDate: start, endDate: cycleForm.endDate || autoEnd });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                    <input
                      type="date"
                      value={cycleForm.endDate}
                      onChange={(e) => setCycleForm({ ...cycleForm, endDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vision (optional)</label>
                  <textarea
                    value={cycleForm.vision}
                    onChange={(e) => setCycleForm({ ...cycleForm, vision: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                    placeholder="Your vision for this cycle..."
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Theme (optional)</label>
                  <input
                    type="text"
                    value={cycleForm.theme}
                    onChange={(e) => setCycleForm({ ...cycleForm, theme: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g., Deep Focus"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCreateCycle}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                  >
                    <FaCheck /> Create
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowCycleForm(false)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium"
                  >
                    Cancel
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
