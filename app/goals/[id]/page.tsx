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
import { calculateEffortMetrics } from "@/lib/effort-calculations";
import { Outcome, LogEntry } from "../types";
import { formatScheduleLabel } from "@/lib/constants";
import HabitHeatmap from "../components/HabitHeatmap";
import ProgressChart from "../components/ProgressChart";
import TaskItem from "@/app/tasks/components/TaskItem";
import type { EnrichedTask } from "@/app/tasks/components/TaskItem";
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
  const [linkedTasks, setLinkedTasks] = useState<EnrichedTask[]>([]);
  const [taskCompletionDates, setTaskCompletionDates] = useState<{ date: string; value: number; completed: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [sortCol, setSortCol] = useState<"date" | "points" | "status">("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [pendingValues, setPendingValues] = useState<Record<number, string>>({});
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({ open: false, message: "", severity: "success" });

  const today = new Date().toISOString().split("T")[0];

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
  const handleHighlightToggle = (_taskId: number) => {}; // Not used in goal view
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCopy = (_task: any) => {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDiscard = async (task: any) => {
    const skipped = !(task.completion?.skipped);
    setLinkedTasks(prev => prev.map(t => t.id === task.id ? { ...t, completion: { ...t.completion!, skipped } } : t));
    await fetch('/api/tasks/skip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: task.id, skipped }) });
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMoveDate = (_task: any, _dir: -1 | 1) => {};
  const handleTimerToggle = handleCheckboxToggle;
  const handleDurationManualSubmit = handleNumericSubmit;
  const formatTime = (s: number) => { const m = Math.floor(s / 60); const sec = s % 60; return `${m}:${String(sec).padStart(2, '0')}`; };

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
        fetch("/api/outcomes/tasks").then((r) => r.ok ? r.json() : []),
        fetch("/api/outcomes/completions").then((r) => r.ok ? r.json() : {}),
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
        const [goalsData, logData, goalTasks, completions] = await Promise.all([
          fetch("/api/outcomes").then(r => r.ok ? r.json() : []),
          fetch(`/api/outcomes/${outcome.id}/log`).then(r => r.ok ? r.json() : []),
          fetch("/api/outcomes/tasks").then(r => r.ok ? r.json() : []),
          fetch("/api/outcomes/completions").then(r => r.ok ? r.json() : {}),
        ]);
        const found = goalsData.find((o: Outcome) => String(o.id) === String(outcome.id));
        if (found) setOutcome(found);
        setLogs(logData);
        const goalCompletions = completions[outcome.id] || [];
        const todayStr = new Date().toISOString().split('T')[0];
        const newTasks: EnrichedTask[] = goalTasks
          .filter((t: { goalId: number }) => t.goalId === outcome.id)
          .map((t: { id: number; name: string; goalId: number; completionType: string; basePoints: number; target: number | null; unit: string | null; date: string; completed: boolean; value: number | null }) => ({
            id: t.id, name: t.name, goalId: t.goalId, pillarId: 0, frequency: "adhoc",
            customDays: null, repeatInterval: null, completionType: t.completionType || "checkbox",
            basePoints: t.basePoints || 0, target: t.target, unit: t.unit, startDate: t.date, date: t.date,
            periodId: null, _pillarColor: color, _pillarEmoji: '', _pillarName: '',
            completion: { id: t.id, taskId: t.id, completed: t.completed, value: t.value, pointsEarned: 0, isHighlighted: false, skipped: !t.completed && (t.value === null || t.value === 0) && t.date < todayStr, timerStartedAt: null },
          } as EnrichedTask));
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
              {sortedTasks.map(task => (
                <TaskItem
                  key={task.id}
                  task={task}
                  hidePillar
                  showDate={task.startDate ? formatDate(task.startDate, dateFormat) : undefined}
                  goalsList={[]}
                  cycles={[]}
                  maxStarsReached={true}
                  timers={timers}
                  pendingValues={pendingValues}
                  setPendingValues={setPendingValues}
                  openMenuId={openMenuId}
                  setOpenMenuId={setOpenMenuId}
                  actionLoading={actionLoading}
                  menuRef={menuRef}
                  router={router}
                  handleCheckboxToggle={handleCheckboxToggle}
                  handleCountChange={handleCountChange}
                  handleNumericSubmit={handleNumericSubmit}
                  handleTimerToggle={handleTimerToggle}
                  handleDurationManualSubmit={handleDurationManualSubmit}
                  handleHighlightToggle={handleHighlightToggle}
                  handleCopy={handleCopy}
                  handleDelete={handleTaskDelete}
                  handleDiscard={handleDiscard}
                  handleMoveDate={handleMoveDate}
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
