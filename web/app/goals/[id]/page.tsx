"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  FaArrowLeft,
  FaEdit,
  FaArchive,
  FaArrowUp,
  FaArrowDown,
  FaCheck,
  FaTrash,
  FaSyncAlt,
} from "react-icons/fa";
import { Snackbar, Alert as MuiAlert } from "@mui/material";
import { AnimatePresence } from "framer-motion";
import { FaClipboardList, FaCopy } from "react-icons/fa";
import { calculateEffortMetrics } from "@/lib/effort-calculations";
import { getGoalBadge } from "@/lib/goal-badge";
import { Outcome, LogEntry, Cycle } from "../types";
import { formatScheduleLabel } from "@/lib/constants";
import HabitHeatmap from "../components/HabitHeatmap";
import ProgressChart from "../components/ProgressChart";
import LogModal from "../components/LogModal";
import TaskItem from "@/app/tasks/components/TaskItem";
import type { EnrichedTask } from "@/app/tasks/components/TaskItem";
import { formatDate, getTodayString, parseScheduleDays } from "@/lib/format";
import { useTheme } from "@/components/ThemeProvider";

export default function GoalDetailPage() {
  const { data: session, status } = useSession();
  const { dateFormat } = useTheme();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [linkedTasks, setLinkedTasks] = useState<EnrichedTask[]>([]);
  const [taskCompletionDates, setTaskCompletionDates] = useState<{ date: string; value: number; completed: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [logTarget, setLogTarget] = useState(false);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [showCyclePicker, setShowCyclePicker] = useState(false);
  const [sortCol, setSortCol] = useState<"date" | "points" | "status">("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [pendingValues, setPendingValues] = useState<Record<number, string>>({});
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({ open: false, message: "", severity: "success" });

  const today = getTodayString();

  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [actionLoading] = useState<Record<number, boolean>>({});
  const [timers] = useState<Record<number, { running: boolean; elapsed: number }>>({});
  const menuRef = useRef<HTMLDivElement>(null);

  const completeTask = async (taskId: number, date: string, completed: boolean, value?: number) => {
    const body: Record<string, unknown> = { taskId, date, completed };
    if (value !== undefined) body.value = value;
    setLinkedTasks(prev => prev.map(t => t.id === taskId ? {
      ...t,
      completion: { ...t.completion!, completed, value: value ?? t.completion?.value ?? null },
    } : t));
    try {
      await fetch('/api/tasks/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch (err) {
      console.error("Failed to complete task:", err);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCheckboxToggle = (task: any) => {
    const isCompleted = task.completion?.completed || false;
    completeTask(task.id, task.startDate || today, !isCompleted, !isCompleted ? 1 : 0);
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCountChange = (task: any, delta: number) => {
    const cur = (task.completion?.value || 0) + delta;
    const newVal = Math.max(0, cur);
    const done = task.target != null && task.target > 0 && newVal >= task.target;
    completeTask(task.id, task.startDate || today, done, newVal);
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNumericSubmit = (task: any) => {
    const val = parseFloat(pendingValues[task.id] || "0") || 0;
    completeTask(task.id, task.startDate || today, val > 0, val);
    setPendingValues(prev => { const next = { ...prev }; delete next[task.id]; return next; });
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDiscard = async (task: any) => {
    const skipped = !(task.completion?.skipped);
    setLinkedTasks(prev => prev.map(t => t.id === task.id ? { ...t, completion: { ...t.completion!, skipped } } : t));
    await fetch('/api/tasks/skip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: task.id, skipped }) });
  };
  const handleTimerToggle = handleCheckboxToggle;
  const handleDurationManualSubmit = handleNumericSubmit;
  const formatTime = (s: number) => { const m = Math.floor(s / 60); const sec = s % 60; return `${m}:${String(sec).padStart(2, '0')}`; };

  const handleTaskDelete = async (taskId: number) => {
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      setLinkedTasks(prev => prev.filter(t => t.id !== taskId));
      // Decrement targetValue for project goals
      if (outcome && isProject && outcome.targetValue > 0) {
        const newTarget = outcome.targetValue - 1;
        fetch(`/api/goals/${outcome.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetValue: newTarget }),
        });
        setOutcome({ ...outcome, targetValue: newTarget });
      }
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
    setConfirmDialog(null);
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      setLoading(false);
      return;
    }
    if (session?.user?.id) {
      fetch("/api/cycles").then(r => r.ok ? r.json() : []).then(setCycles);
      Promise.all([
        fetch("/api/goals").then((r) => r.ok ? r.json() : []),
        fetch(`/api/goals/${id}/log`).then((r) => r.ok ? r.json() : []),
        fetch("/api/goals/tasks").then((r) => r.ok ? r.json() : []),
        fetch("/api/goals/completions").then((r) => r.ok ? r.json() : {}),
      ]).then(([goalsData, logData, goalTasks, completions]: [Outcome[], LogEntry[], { id: number; name: string; goalId: number; completionType: string; basePoints: number; target: number | null; unit: string | null; date: string; completed: boolean; value: number | null }[], Record<number, { date: string; value: number; completed: boolean }[]>]) => {
        const found = goalsData.find((o: Outcome) => String(o.id) === id);
        setOutcome(found || null);
        setLogs(logData);

        const goalCompletions = completions[parseInt(id)] || [];

        const tasks: EnrichedTask[] = goalTasks
          .filter(t => t.goalId === parseInt(id))
          .map(t => ({
            id: t.id,
            name: t.name,
            goalId: t.goalId,
            pillarId: 0,
            frequency: "adhoc",
            customDays: null,
            repeatInterval: null,
            completionType: t.completionType || "checkbox",
            basePoints: t.basePoints || 0,
            target: t.target,
            unit: t.unit,
            startDate: t.date,
            date: t.date,
            completion: {
              id: t.id,
              taskId: t.id,
              completed: t.completed,
              value: t.value,
              pointsEarned: 0,
              isHighlighted: false,
              skipped: !t.completed && (t.value === null || t.value === 0) && t.date < today,
              timerStartedAt: null,
            },
            periodId: null,
            _pillarColor: color,
            _pillarEmoji: '',
            _pillarName: '',
          } as EnrichedTask));

        setLinkedTasks(tasks);
        setTaskCompletionDates(goalCompletions);

        // Sync targetValue with actual task count for project goals
        if (found && found.goalType === 'project' && tasks.length !== found.targetValue) {
          fetch(`/api/goals/${found.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetValue: tasks.length }),
          });
          setOutcome({ ...found, targetValue: tasks.length });
        }

        setLoading(false);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status, router, id]);

  const scheduleDays: number[] = parseScheduleDays(outcome?.scheduleDays);
  const isHabitual = outcome?.goalType === "habitual";
  const isProject = outcome?.goalType === "project";
  const isActivityGoal = outcome?.goalType === "target" || outcome?.goalType === "habitual";
  const color = outcome?.pillarColor || "#3B82F6";

  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskDate, setNewTaskDate] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  const refreshLinkedTasks = async (opts?: { includeLog?: boolean }) => {
    if (!outcome) return;
    const [goalsData, goalTasks, logData] = await Promise.all([
      fetch("/api/goals").then(r => r.ok ? r.json() : []),
      fetch("/api/goals/tasks").then(r => r.ok ? r.json() : []),
      opts?.includeLog
        ? fetch(`/api/goals/${id}/log`).then(r => r.ok ? r.json() : [])
        : Promise.resolve(null),
    ]);
    const found = (goalsData as Outcome[]).find(o => String(o.id) === id);
    if (found) setOutcome(found);
    const todayStr = getTodayString();
    const tasks: EnrichedTask[] = (goalTasks as { id: number; name: string; goalId: number; completionType: string; basePoints: number; target: number | null; unit: string | null; date: string; completed: boolean; value: number | null }[])
      .filter(t => t.goalId === parseInt(id))
      .map(t => ({
        id: t.id, name: t.name, goalId: t.goalId, pillarId: 0, frequency: "adhoc",
        customDays: null, repeatInterval: null, completionType: t.completionType || "checkbox",
        basePoints: t.basePoints || 0, target: t.target, unit: t.unit, startDate: t.date, date: t.date,
        periodId: null, _pillarColor: color, _pillarEmoji: '', _pillarName: '',
        completion: { id: t.id, taskId: t.id, completed: t.completed, value: t.value, pointsEarned: 0, isHighlighted: false, skipped: !t.completed && (t.value === null || t.value === 0) && t.date < todayStr, timerStartedAt: null },
      } as EnrichedTask));
    setLinkedTasks(tasks);
    if (logData) setLogs(logData as LogEntry[]);
  };

  const handleAddSubtask = async () => {
    if (!outcome || !newTaskName.trim()) return;
    setAddingTask(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTaskName.trim(),
          frequency: "adhoc",
          goalId: outcome.id,
          startDate: newTaskDate || "",
          completionType: "checkbox",
          basePoints: outcome.basePoints,
          pillarId: outcome.pillarId,
        }),
      });
      if (res.ok) {
        // Bump goal targetValue by 1 so progress reflects the new step count
        await fetch(`/api/goals/${outcome.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetValue: (outcome.targetValue || 0) + 1 }),
        });
        setNewTaskName("");
        setNewTaskDate("");
        await refreshLinkedTasks();
      } else {
        setSnackbar({ open: true, message: "Failed to add subtask", severity: "error" });
      }
    } catch {
      setSnackbar({ open: true, message: "Failed to add subtask", severity: "error" });
    }
    setAddingTask(false);
  };

  const getProgress = (o: Outcome) => {
    const range = o.targetValue - o.startValue;
    if (range === 0) return o.goalType === 'project' ? 0 : 100;
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
      if (d.completed || d.value > 0) dates.add(d.date);
    }
    return dates;
  }, [logs, taskCompletionDates]);

  const heatmapValues = useMemo(() => {
    const values = new Map<string, number>();
    for (const d of taskCompletionDates) {
      if (d.value > 0) {
        values.set(d.date, (values.get(d.date) || 0) + d.value);
      }
    }
    for (const l of logs) {
      const dateStr = l.loggedAt.split('T')[0];
      if (l.value > 0) {
        values.set(dateStr, (values.get(dateStr) || 0) + l.value);
      }
    }
    return values;
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
          cmp = (a.completion?.completed ? 1 : 0) - (b.completion?.completed ? 1 : 0);
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



  const handleLogSave = async (value: number, logDate: string | null) => {
    if (!outcome) return;
    try {
      const res = await fetch(`/api/goals/${outcome.id}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value, loggedAt: logDate }),
      });
      if (res.ok) {
        // Refresh data
        const [goalsData, logData] = await Promise.all([
          fetch("/api/goals").then(r => r.ok ? r.json() : []),
          fetch(`/api/goals/${outcome.id}/log`).then(r => r.ok ? r.json() : []),
        ]);
        const found = goalsData.find((o: Outcome) => String(o.id) === id);
        if (found) setOutcome(found);
        setLogs(logData);
        setSnackbar({ open: true, message: "Progress logged", severity: "success" });
      }
    } catch {
      setSnackbar({ open: true, message: "Failed to log progress", severity: "error" });
    }
    setLogTarget(false);
  };

  const handleCopyToCycle = async (cycleId: number) => {
    if (!outcome) return;
    const cycle = cycles.find(c => c.id === cycleId);
    if (!cycle) return;
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: outcome.name, targetValue: outcome.targetValue, unit: outcome.unit,
          pillarId: outcome.pillarId, periodId: cycleId, goalType: outcome.goalType,
          completionType: outcome.completionType, dailyTarget: outcome.dailyTarget,
          scheduleDays: parseScheduleDays(outcome.scheduleDays),
          autoCreateTasks: outcome.autoCreateTasks, startValue: outcome.startValue,
          startDate: cycle.startDate, targetDate: cycle.endDate,
        }),
      });
      if (res.ok) {
        setSnackbar({ open: true, message: `Goal copied to ${cycle.name}`, severity: "success" });
        setShowCyclePicker(false);
      }
    } catch {
      setSnackbar({ open: true, message: "Failed to copy goal", severity: "error" });
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
        await fetch(`/api/goals/${outcome.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        // Refresh linked tasks + log so the reactivated/deleted instances
        // and the status-change log entry show up without a manual reload.
        await refreshLinkedTasks({ includeLog: true });
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
        await fetch(`/api/goals/${outcome.id}`, { method: "DELETE" });
        router.push("/goals");
      },
    });
  };

  const handleGenerateTasks = async () => {
    if (!outcome) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/goals/${outcome.id}/generate-tasks`, { method: "POST" });
      if (res.ok) {
        setSnackbar({ open: true, message: "Tasks generated successfully", severity: "success" });
        await refreshLinkedTasks({ includeLog: true });
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
          {!isActivityGoal && !isProject && (
            outcome.targetValue < outcome.startValue ? (
              <FaArrowDown className={`shrink-0 ${progress > 0 ? 'text-green-500' : 'text-red-500'}`} />
            ) : (
              <FaArrowUp className={`shrink-0 ${progress > 0 ? 'text-green-500' : 'text-red-500'}`} />
            )
          )}
          {outcome.pillarName && (
            <span className="text-sm shrink-0 hidden md:inline" style={{ color: outcome.pillarColor || "#6B7280" }}>
              {outcome.pillarEmoji} {outcome.pillarName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleDelete}
            disabled={archiving}
            className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
            title="Delete"
          >
            <FaTrash />
          </button>
        </div>
      </div>

      {/* Action buttons row */}
      {outcome.status === 'active' ? (
        <div className="flex flex-wrap gap-2 mb-4">
          {!isProject && (
            <button onClick={() => setLogTarget(true)} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600">
              Log Progress
            </button>
          )}
          <button onClick={() => router.push(`/goals/${outcome.id}/edit`)} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600">
            Edit
          </button>
          <button onClick={() => handleStatusChange('completed')} disabled={archiving} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 disabled:opacity-50">
            Complete
          </button>
          <button onClick={() => handleStatusChange('abandoned')} disabled={archiving} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 disabled:opacity-50">
            Abandon
          </button>
          <div className="relative">
            <button onClick={() => setShowCyclePicker(!showCyclePicker)} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600">
              Copy to Cycle
            </button>
            {showCyclePicker && (
              <div className="absolute left-0 top-9 w-48 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 z-50 overflow-hidden">
                {cycles.length === 0 ? (
                  <p className="px-4 py-2 text-xs text-zinc-400">No cycles</p>
                ) : cycles.map(c => (
                  <button key={c.id} onClick={() => handleCopyToCycle(c.id)} className="w-full px-4 py-2 text-left text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700">
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {outcome.autoCreateTasks && (
            <button onClick={handleGenerateTasks} disabled={generating} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50">
              {generating ? "Generating..." : "Generate Tasks"}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => handleStatusChange('active')} disabled={archiving} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50">
            Reactivate
          </button>
        </div>
      )}

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
          ) : isProject ? (
            <>
              {outcome.targetValue > 0 ? (
                <>
                  <span className="text-lg font-semibold text-zinc-900 dark:text-white">
                    {outcome.currentValue} of {outcome.targetValue} steps
                  </span>
                  <span className="font-medium">{Math.round(progress)}%</span>
                </>
              ) : (
                <span className="text-lg font-semibold text-zinc-900 dark:text-white">No steps yet</span>
              )}
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
          {outcome && (() => {
            const badge = getGoalBadge(outcome, today);
            if (!badge) return null;
            const cls = badge.color === '#22C55E' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            return (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
                {badge.value.toFixed(1)}x · {badge.label}
              </span>
            );
          })()}
          {/* Dates inline */}
          {outcome.startDate && (
            <span className="text-xs">
              {formatDate(outcome.startDate, dateFormat)}
              {outcome.targetDate && ` - ${formatDate(outcome.targetDate, dateFormat)}`}
            </span>
          )}
          {/* Schedule days inline */}
          {isActivityGoal && scheduleDays.length > 0 && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {formatScheduleLabel(scheduleDays)}
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
            dateValues={heatmapValues}
            dailyTarget={outcome.dailyTarget}
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
        {(linkedTasks.length > 0 || isProject) && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                {isProject ? "Steps" : "Linked Tasks"}
              </h3>
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
            {isProject && outcome.status === 'active' && (
              <div className="flex flex-col gap-2 mb-3 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                <input
                  type="text"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !addingTask) handleAddSubtask(); }}
                  placeholder="Add a step…"
                  className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                />
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={newTaskDate}
                    onChange={(e) => setNewTaskDate(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                  />
                  <button
                    onClick={handleAddSubtask}
                    disabled={addingTask || !newTaskName.trim()}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {addingTask ? "Adding…" : "Add"}
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              {sortedTasks.map(task => (
                <TaskItem
                  key={task.id}
                  task={task}
                  hidePillar
                  showDate={task.startDate ? formatDate(task.startDate, dateFormat) : undefined}
                  goalsList={outcome ? [outcome] : []}
                  cycles={cycles}
                  maxStarsReached={true}
                  timers={timers}
                  pendingValues={pendingValues}
                  setPendingValues={setPendingValues}
                  actionLoading={actionLoading}
                  router={router}
                  handleCheckboxToggle={handleCheckboxToggle}
                  handleCountChange={handleCountChange}
                  handleNumericSubmit={handleNumericSubmit}
                  handleTimerToggle={handleTimerToggle}
                  handleDurationManualSubmit={handleDurationManualSubmit}
                  handleDiscard={handleDiscard}
                  formatTime={formatTime}
                />
              ))}
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

      {/* Log Modal */}
      <AnimatePresence>
        {logTarget && outcome && (
          <LogModal
            logTarget={outcome}
            onClose={() => setLogTarget(false)}
            onSave={handleLogSave}
          />
        )}
      </AnimatePresence>

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
