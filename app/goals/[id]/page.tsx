"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  FaArrowLeft,
  FaEdit,
  FaArchive,
  FaArrowUp,
  FaArrowDown,
  FaSortAmountDown,
  FaSortAmountUp,
  FaCheck,
  FaPlus,
  FaMinus,
  FaTrash,
  FaSyncAlt,
} from "react-icons/fa";
import { Snackbar, Alert as MuiAlert } from "@mui/material";
import { calculateEffortMetrics, countScheduledDaysInRange } from "@/lib/effort-calculations";
import { Outcome, LogEntry, LinkedTask } from "../types";
import { DAY_NAMES } from "../constants";
import HabitHeatmap from "../components/HabitHeatmap";
import ProgressChart from "../components/ProgressChart";
import { formatDate } from "@/lib/format";
import { useTheme } from "@/components/ThemeProvider";

export default function GoalDetailPage() {
  const { data: session, status } = useSession();
  const { dateFormat } = useTheme();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [linkedTasks, setLinkedTasks] = useState<LinkedTask[]>([]);
  const [taskCompletionDates, setTaskCompletionDates] = useState<{ date: string; value: number; completed: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [sortCol, setSortCol] = useState<"date" | "points" | "status">("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [pendingValues, setPendingValues] = useState<Record<number, string>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({ open: false, message: "", severity: "success" });

  const today = new Date().toISOString().split("T")[0];

  const handleTaskComplete = async (task: LinkedTask, completed: boolean, value?: number) => {
    const date = task.startDate || today;
    const body: Record<string, unknown> = { taskId: task.id, date, completed };
    if (value !== undefined) body.value = value;
    setLinkedTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed, value: value ?? t.value } : t));
    try {
      await fetch('/api/tasks/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch (err) {
      console.error("Failed to complete task:", err);
    }
  };

  const handleTaskDelete = async (taskId: number) => {
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      setLinkedTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
    setDeleteConfirmId(null);
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      setLoading(false);
      return;
    }
    if (session?.user?.id) {
      Promise.all([
        fetch("/api/outcomes").then((r) => r.ok ? r.json() : []),
        fetch(`/api/outcomes/${id}/log`).then((r) => r.ok ? r.json() : []),
        fetch("/api/tasks").then((r) => r.ok ? r.json() : []),
        fetch("/api/outcomes/completions").then((r) => r.ok ? r.json() : {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ]).then(([goalsData, logData, taskGroups, completions]: [Outcome[], LogEntry[], any[], Record<number, { date: string; value: number; completed: boolean }[]>]) => {
        const found = goalsData.find((o: Outcome) => String(o.id) === id);
        setOutcome(found || null);
        setLogs(logData);

        // Build sets for determining completion status of linked tasks
        const goalCompletions = completions[parseInt(id)] || [];
        const completedDatesSet = new Set<string>(goalCompletions.filter(e => e.completed).map(e => e.date));
        const logValueByDate = new Map<string, number>();
        for (const log of logData) {
          const dateStr = log.loggedAt.split('T')[0];
          logValueByDate.set(dateStr, log.value);
        }

        const tasks: LinkedTask[] = [];
        for (const group of taskGroups) {
          for (const task of group.tasks) {
            if (task.goalId === parseInt(id)) {
              const isCompletedToday = task.completion?.completed || false;
              const isCompletedOnDate = task.startDate ? completedDatesSet.has(task.startDate) : false;
              const taskValue = task.completion?.value ?? (task.startDate ? logValueByDate.get(task.startDate) ?? null : null);

              tasks.push({
                id: task.id,
                name: task.name,
                goalId: task.goalId,
                frequency: task.frequency || "daily",
                completionType: task.completionType || "checkbox",
                basePoints: task.basePoints || 0,
                target: task.target ?? null,
                unit: task.unit ?? null,
                completed: isCompletedToday || isCompletedOnDate,
                value: taskValue,
                startDate: task.startDate || null,
              });
            }
          }
        }
        setLinkedTasks(tasks);
        setTaskCompletionDates(goalCompletions);
        setLoading(false);
      });
    }
  }, [session, status, router, id]);

  const scheduleDays: number[] = outcome?.scheduleDays ? JSON.parse(outcome.scheduleDays) : [];
  const isHabitual = outcome?.goalType === "habitual";
  const isActivityGoal = outcome?.goalType === "target" || outcome?.goalType === "habitual";
  const color = outcome?.pillarColor || "#3B82F6";

  const getProgress = (o: Outcome) => {
    const range = o.targetValue - o.startValue;
    if (range === 0) return 100;
    return Math.min((o.currentValue - o.startValue) / range * 100, 100);
  };

  const progress = outcome ? getProgress(outcome) : 0;

  const effortMetrics = useMemo(() => {
    if (!outcome || !isActivityGoal || !outcome.startDate || !outcome.targetDate || scheduleDays.length === 0) return null;
    return calculateEffortMetrics(
      outcome.startDate, outcome.targetDate, scheduleDays,
      outcome.targetValue, outcome.currentValue, today, outcome.startValue
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome, isActivityGoal, today]);

  const allDoneDates = useMemo(() => {
    const dates = new Set<string>();
    for (const l of logs) dates.add(l.loggedAt.split('T')[0]);
    for (const d of taskCompletionDates) {
      if (d.completed) dates.add(d.date);
    }
    return dates;
  }, [logs, taskCompletionDates]);

  const streak = useMemo(() => {
    if (!isHabitual || allDoneDates.size === 0) return 0;
    let count = 0;
    const d = new Date(today + 'T12:00:00');
    if (!allDoneDates.has(today)) d.setDate(d.getDate() - 1);
    while (true) {
      const dateStr = d.toISOString().split('T')[0];
      if (scheduleDays.length > 0 && !scheduleDays.includes(d.getDay())) {
        d.setDate(d.getDate() - 1);
        continue;
      }
      if (allDoneDates.has(dateStr)) {
        count++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return count;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHabitual, allDoneDates, today]);

  const sortedTasks = useMemo(() => {
    const sorted = [...linkedTasks].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "date":
          cmp = (a.startDate || "").localeCompare(b.startDate || "");
          break;
        case "points":
          cmp = a.basePoints - b.basePoints;
          break;
        case "status":
          cmp = (a.completed ? 1 : 0) - (b.completed ? 1 : 0);
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }, [linkedTasks, sortCol, sortAsc]);

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  const getExpectedValue = (taskDate: string) => {
    if (!outcome || !outcome.startDate || !outcome.targetDate || outcome.goalType !== "outcome") return null;
    if (taskDate < outcome.startDate || taskDate > outcome.targetDate) return null;
    const totalDays = scheduleDays.length > 0
      ? countScheduledDaysInRange(outcome.startDate, outcome.targetDate, scheduleDays)
      : Math.max(1, Math.round((new Date(outcome.targetDate).getTime() - new Date(outcome.startDate).getTime()) / 86400000));
    const elapsedDays = scheduleDays.length > 0
      ? countScheduledDaysInRange(outcome.startDate, taskDate, scheduleDays)
      : Math.max(0, Math.round((new Date(taskDate).getTime() - new Date(outcome.startDate).getTime()) / 86400000));
    const expected = outcome.startValue + (outcome.targetValue - outcome.startValue) * (elapsedDays / totalDays);
    return Math.round(expected * 10) / 10;
  };

  const frequencyLabel = (freq: string) => {
    // Goal-linked tasks are stored as 'adhoc' but recur per the goal's schedule
    if (freq === "adhoc" && scheduleDays.length > 0) {
      return scheduleDays.map((d: number) => DAY_NAMES[d]).join(", ");
    }
    switch (freq) {
      case "daily": return "Daily";
      case "weekly": return "Weekly";
      case "monthly": return "Monthly";
      case "adhoc": return "One-time";
      case "custom": return "Custom";
      case "interval": return "Interval";
      default: return freq;
    }
  };

  const handleStatusChange = (newStatus: 'active' | 'completed' | 'abandoned') => {
    if (!outcome) return;
    const label = newStatus === 'completed' ? 'complete' : newStatus === 'abandoned' ? 'abandon' : 'reactivate';
    setConfirmDialog({
      message: `Are you sure you want to ${label} this goal?`,
      onConfirm: async () => {
        setConfirmDialog(null);
        setArchiving(true);
        await fetch(`/api/outcomes/${outcome.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        setOutcome({ ...outcome, status: newStatus });
        setArchiving(false);
      },
    });
  };

  const handleDelete = () => {
    if (!outcome) return;
    setConfirmDialog({
      message: "Permanently delete this goal and all its data?",
      onConfirm: async () => {
        setConfirmDialog(null);
        setArchiving(true);
        await fetch(`/api/outcomes/${outcome.id}`, { method: "DELETE" });
        router.push("/goals");
      },
    });
  };

  const handleGenerateTasks = async () => {
    if (!outcome) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/outcomes/${outcome.id}/generate-tasks`, { method: "POST" });
      if (res.ok) {
        setSnackbar({ open: true, message: "Tasks generated successfully", severity: "success" });
        // Refresh everything — same as initial load
        const [goalsData, logData, taskGroups, completions] = await Promise.all([
          fetch("/api/outcomes").then(r => r.ok ? r.json() : []),
          fetch(`/api/outcomes/${outcome.id}/log`).then(r => r.ok ? r.json() : []),
          fetch("/api/tasks").then(r => r.ok ? r.json() : []),
          fetch("/api/outcomes/completions").then(r => r.ok ? r.json() : {}),
        ]);
        const found = goalsData.find((o: Outcome) => String(o.id) === String(outcome.id));
        if (found) setOutcome(found);
        setLogs(logData);
        const goalCompletions = completions[outcome.id] || [];
        const completedDatesSet = new Set<string>(goalCompletions.filter((e: { completed: boolean; date: string }) => e.completed).map((e: { date: string }) => e.date));
        const logValueByDate = new Map<string, number>();
        for (const log of logData) {
          const dateStr = log.loggedAt.split('T')[0];
          logValueByDate.set(dateStr, log.value);
        }
        const newTasks: LinkedTask[] = [];
        for (const group of taskGroups) {
          for (const task of group.tasks) {
            if (task.goalId === outcome.id) {
              const isCompletedToday = task.completion?.completed || false;
              const isCompletedOnDate = task.startDate ? completedDatesSet.has(task.startDate) : false;
              const taskValue = task.completion?.value ?? (task.startDate ? logValueByDate.get(task.startDate) ?? null : null);
              newTasks.push({ id: task.id, name: task.name, goalId: task.goalId, frequency: task.frequency || "daily", completionType: task.completionType || "checkbox", basePoints: task.basePoints || 0, target: task.target ?? null, unit: task.unit ?? null, completed: isCompletedToday || isCompletedOnDate, value: taskValue, startDate: task.startDate || null });
            }
          }
        }
        setLinkedTasks(newTasks);
        setTaskCompletionDates(goalCompletions);
      } else {
        setSnackbar({ open: true, message: "Failed to generate tasks", severity: "error" });
      }
    } catch {
      setSnackbar({ open: true, message: "Failed to generate tasks", severity: "error" });
    }
    setGenerating(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-600"></div>
      </div>
    );
  }

  if (!outcome) {
    return (
      <div className="container mx-auto px-4 py-4 md:py-8 max-w-4xl">
        <p className="text-zinc-500 dark:text-zinc-400">Goal not found.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push("/goals")}
            className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 shrink-0"
          >
            <FaArrowLeft />
          </button>
          <h1 className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-white truncate">{outcome.name}</h1>
          {outcome.status === 'completed' && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 shrink-0">Completed</span>
          )}
          {outcome.status === 'abandoned' && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 shrink-0">Abandoned</span>
          )}
          {!isActivityGoal && (
            outcome.targetValue < outcome.startValue ? (
              <FaArrowDown className="text-green-500 shrink-0" />
            ) : (
              <FaArrowUp className="text-green-500 shrink-0" />
            )
          )}
          {outcome.pillarName && (
            <span className="text-sm shrink-0 hidden md:inline" style={{ color: outcome.pillarColor || "#6B7280" }}>
              {outcome.pillarEmoji} {outcome.pillarName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {outcome.status === 'active' ? (
            <>
              <button
                onClick={() => handleStatusChange('completed')}
                disabled={archiving}
                className="p-2 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50"
                title="Mark as Complete"
              >
                <FaCheck />
              </button>
              {outcome.autoCreateTasks && (
                <button
                  onClick={handleGenerateTasks}
                  disabled={generating}
                  className="p-2 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50"
                  title="Generate Tasks"
                >
                  <FaSyncAlt className={generating ? "animate-spin" : ""} />
                </button>
              )}
              <button
                onClick={() => router.push(`/goals/${outcome.id}/edit`)}
                className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                title="Edit"
              >
                <FaEdit />
              </button>
              <button
                onClick={() => handleStatusChange('abandoned')}
                disabled={archiving}
                className="p-2 rounded-lg text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50"
                title="Abandon"
              >
                <FaArchive />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleStatusChange('active')}
                disabled={archiving}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 disabled:opacity-50"
              >
                Reactivate
              </button>
              <button
                onClick={handleDelete}
                disabled={archiving}
                className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                title="Delete"
              >
                <FaTrash />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Summary row: metrics + status badge inline */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
          {isHabitual ? (
            <>
              {outcome.dailyTarget ? <span>{outcome.dailyTarget} {outcome.unit}/session</span> : <span>{outcome.unit}</span>}
              <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 font-medium">
                {streak}🔥
              </span>
            </>
          ) : (
            <>
              <span className="text-lg font-semibold text-zinc-900 dark:text-white">
                {outcome.currentValue} / {outcome.targetValue} {outcome.unit}
              </span>
              <span className="font-medium">{Math.round(progress)}%</span>
              {effortMetrics && <span>{effortMetrics.currentRate}/day</span>}
            </>
          )}
          {isActivityGoal && effortMetrics && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              effortMetrics.status === 'ahead' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
              effortMetrics.status === 'on_track' ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' :
              'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {effortMetrics.status === 'ahead' ? 'Ahead' : effortMetrics.status === 'on_track' ? 'On track' : 'Behind'}
            </span>
          )}
          {/* Dates inline */}
          {outcome.startDate && (
            <span className="text-xs">
              {formatDate(outcome.startDate, dateFormat)}
              {outcome.targetDate && ` - ${formatDate(outcome.targetDate, dateFormat)}`}
            </span>
          )}
          {/* Schedule days inline */}
          {isActivityGoal && scheduleDays.length > 0 && scheduleDays.length < 7 && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {scheduleDays.map((d) => DAY_NAMES[d]).join(", ")}
            </span>
          )}
        </div>

        {/* Progress bar (target/outcome) */}
        {!isHabitual && (
          <div>
            <div className="w-full h-3 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ backgroundColor: color }}
              />
            </div>
            <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              <span>{outcome.startValue} {outcome.unit}</span>
              <span>{outcome.targetValue} {outcome.unit}</span>
            </div>
          </div>
        )}

        {/* Effort Metrics - compact grid */}
        {!isHabitual && isActivityGoal && effortMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div className="bg-zinc-50 dark:bg-zinc-700/50 rounded-lg px-3 py-2">
              <span className="text-zinc-500 dark:text-zinc-400 text-xs">Initial target: </span>
              <span className="font-semibold text-zinc-900 dark:text-white">{effortMetrics.dailyTarget} {outcome.unit}/day</span>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-700/50 rounded-lg px-3 py-2">
              <span className="text-zinc-500 dark:text-zinc-400 text-xs">Required: </span>
              <span className="font-semibold text-zinc-900 dark:text-white">{effortMetrics.requiredRate}/day</span>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-700/50 rounded-lg px-3 py-2">
              <span className="text-zinc-500 dark:text-zinc-400 text-xs">Current: </span>
              <span className="font-semibold text-zinc-900 dark:text-white">{effortMetrics.currentRate}/day</span>
            </div>
            {effortMetrics.projectedDate && (
              <div className="bg-zinc-50 dark:bg-zinc-700/50 rounded-lg px-3 py-2">
                <span className="text-zinc-500 dark:text-zinc-400 text-xs">Projected: </span>
                <span className="font-semibold text-zinc-900 dark:text-white">
                  {formatDate(effortMetrics.projectedDate, dateFormat)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Habitual Heatmap */}
        {isHabitual && outcome.startDate && (
          <HabitHeatmap
            startDate={outcome.startDate}
            endDate={outcome.targetDate}
            scheduleDays={scheduleDays}
            doneDates={allDoneDates}
            today={today}
          />
        )}

        {/* Progress Chart */}
        {!isHabitual && (
          <ProgressChart
            outcome={outcome}
            logs={logs}
            color={color}
          />
        )}

        {/* Linked Tasks */}
        {linkedTasks.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Linked Tasks</h3>
              <div className="flex items-center gap-1">
                {(["date", "status"] as const).map(col => (
                  <button
                    key={col}
                    onClick={() => toggleSort(col)}
                    className={`text-[11px] px-2 py-0.5 rounded font-medium transition-colors ${
                      sortCol === col
                        ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                    }`}
                  >
                    {col === "date" ? "Date" : "Status"}
                    {sortCol === col && (sortAsc ? " ↑" : " ↓")}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {sortedTasks.map(task => {
                const currentValue = task.value || 0;
                const isFullyDone = task.completed || (task.target != null && task.target > 0 && currentValue >= task.target);
                return (
                  <div
                    key={task.id}
                    className={`rounded-lg px-3 py-2.5 transition-all ${
                      isFullyDone
                        ? "bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800"
                        : "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
                    }`}
                    style={{ borderLeftWidth: 3, borderLeftColor: isFullyDone ? "#4ade80" : color }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-sm font-semibold leading-snug ${isFullyDone ? "line-through text-zinc-400 dark:text-zinc-500" : "text-zinc-900 dark:text-white"}`}>
                          {task.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            {task.startDate ? formatDate(task.startDate, dateFormat) : "No date"}
                          </span>
                          <span className="text-[11px] px-1.5 py-px rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400">
                            {frequencyLabel(task.frequency)}
                          </span>
                          {task.startDate && (() => {
                            const expected = getExpectedValue(task.startDate);
                            return expected !== null ? (
                              <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                                exp: {expected} {outcome?.unit}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                        {task.completionType === "checkbox" && (
                          <button
                            onClick={() => handleTaskComplete(task, !isFullyDone, !isFullyDone ? 1 : 0)}
                            className={`w-7 h-7 rounded-md border-2 flex items-center justify-center transition-colors ${
                              isFullyDone
                                ? "bg-green-500 border-green-500 text-white"
                                : "border-zinc-300 dark:border-zinc-600 hover:border-green-500"
                            }`}
                          >
                            {isFullyDone && <FaCheck className="text-xs" />}
                          </button>
                        )}

                        {task.completionType === "count" && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                const newVal = Math.max(0, currentValue - 1);
                                const done = task.target != null && task.target > 0 && newVal >= task.target;
                                handleTaskComplete(task, done, newVal);
                              }}
                              className="w-6 h-6 rounded bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center hover:bg-zinc-300 dark:hover:bg-zinc-600"
                            >
                              <FaMinus className="text-[9px]" />
                            </button>
                            <span className={`text-xs font-bold min-w-[2.5rem] text-center ${
                              task.target && currentValue >= task.target ? "text-green-600 dark:text-green-400" : "text-zinc-900 dark:text-white"
                            }`}>
                              {currentValue}/{task.target || "?"}
                            </span>
                            <button
                              onClick={() => {
                                const newVal = currentValue + 1;
                                const done = task.target != null && task.target > 0 && newVal >= task.target;
                                handleTaskComplete(task, done, newVal);
                              }}
                              className="w-6 h-6 rounded bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center hover:bg-zinc-800 dark:hover:bg-zinc-100"
                            >
                              <FaPlus className="text-[9px]" />
                            </button>
                          </div>
                        )}

                        {(task.completionType === "numeric" || task.completionType === "duration") && (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={pendingValues[task.id] ?? (currentValue || "")}
                              onChange={e => setPendingValues(prev => ({ ...prev, [task.id]: e.target.value }))}
                              onKeyDown={e => {
                                if (e.key === "Enter") {
                                  const val = parseFloat(pendingValues[task.id] || "0") || 0;
                                  handleTaskComplete(task, val > 0, val);
                                  setPendingValues(prev => { const next = { ...prev }; delete next[task.id]; return next; });
                                }
                              }}
                              placeholder={task.target ? String(task.target) : "0"}
                              className="w-14 px-1.5 py-1 text-xs text-right border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                            />
                            {task.unit && <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{task.unit}</span>}
                            {pendingValues[task.id] !== undefined && (
                              <button
                                onClick={() => {
                                  const val = parseFloat(pendingValues[task.id] || "0") || 0;
                                  handleTaskComplete(task, val > 0, val);
                                  setPendingValues(prev => { const next = { ...prev }; delete next[task.id]; return next; });
                                }}
                                className="w-6 h-6 rounded bg-green-500 text-white flex items-center justify-center hover:bg-green-600"
                              >
                                <FaCheck className="text-[9px]" />
                              </button>
                            )}
                          </div>
                        )}

                        <button
                          onClick={() => router.push(`/tasks/${task.id}/edit`)}
                          className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700"
                          title="Edit task"
                        >
                          <FaEdit className="text-[10px]" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(task.id)}
                          className="p-1 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Delete task"
                        >
                          <FaTrash className="text-[10px]" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Delete confirmation dialog */}
        {deleteConfirmId !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteConfirmId(null)}>
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-lg p-5 mx-4 max-w-sm w-full" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">Delete Task</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                This will permanently remove this task from scoring. Are you sure?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 text-sm rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleTaskDelete(deleteConfirmId)}
                  className="px-4 py-2 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setConfirmDialog(null)}>
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl p-6 mx-4 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <p className="text-sm text-zinc-900 dark:text-white mb-4">{confirmDialog.message}</p>
            <div className="flex gap-2 justify-end">
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
          </div>
        </div>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <MuiAlert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} variant="filled" sx={{ width: "100%" }}>
          {snackbar.message}
        </MuiAlert>
      </Snackbar>
    </div>
  );
}
