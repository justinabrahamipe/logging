"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  FaArrowLeft,
  FaEdit,
  FaTrash,
  FaStar,
  FaRegStar,
  FaCopy,
  FaArrowRight,
  FaCheck,
  FaPlus,
  FaMinus,
  FaPlay,
  FaPause,
  FaTimes,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import { useTheme } from "@/components/ThemeProvider";
import { formatDate, getTodayString, getYesterdayString } from "@/lib/format";
import type { Task, Pillar, Outcome } from "@/lib/types";

interface TaskDetail extends Task {
  completed?: boolean;
  value?: number | null;
  skipped?: boolean;
  isHighlighted?: boolean;
  date?: string;
  originalDate?: string | null;
  pointsEarned?: number;
}

export default function TaskDetailPage() {
  const { data: session, status } = useSession();
  const { habitualColor, targetColor, outcomeColor, dateFormat } = useTheme();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [pillar, setPillar] = useState<Pillar | null>(null);
  const [goal, setGoal] = useState<Outcome | null>(null);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingNumeric, setPendingNumeric] = useState("");
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [duplicating, setDuplicating] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const today = getTodayString();
  const yesterday = getYesterdayString();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (session?.user?.id) {
      Promise.all([
        fetch(`/api/tasks/${id}`).then((r) => (r.ok ? r.json() : null)),
        fetch("/api/pillars").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/goals").then((r) => (r.ok ? r.json() : [])),
      ]).then(([t, pillars, goals]) => {
        if (t) {
          if (t.date && !t.startDate) t.startDate = t.date;
          setTask(t);
          setDescription(t.description || "");
          if (t.timerStartedAt) {
            setTimerRunning(true);
            const elapsedSec = Math.floor((Date.now() - t.timerStartedAt) / 1000) + ((t.value || 0) * 60);
            setTimerElapsed(elapsedSec);
          } else {
            setTimerElapsed((t.value || 0) * 60);
          }
          if (t.pillarId) {
            const p = pillars.find((p: Pillar) => p.id === t.pillarId);
            if (p) setPillar(p);
          }
          if (t.goalId) {
            const g = goals.find((g: Outcome) => g.id === t.goalId);
            if (g) setGoal(g);
          }
        }
        setLoading(false);
      });
    }
  }, [session, status, router, id]);

  // Timer tick
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimerElapsed((prev) => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-600"></div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="container mx-auto px-4 py-4 md:py-8 max-w-4xl">
        <p className="text-zinc-500 dark:text-zinc-400">Task not found.</p>
      </div>
    );
  }

  const isCompleted = task.completed || false;
  const currentValue = task.value || 0;
  const isSkipped = task.skipped || false;
  const isHighlighted = task.isHighlighted || false;
  const isLimitTask = task.flexibilityRule === "limit_avoid";
  const isFrozen = task.date ? task.date < yesterday : false;
  const taskDate = task.startDate || task.date || "";
  const limitVal = task.limitValue ?? task.target ?? 0;
  const progressTarget = isLimitTask ? limitVal : (task.target || 0);
  const progressPct = progressTarget > 0 ? Math.min((currentValue / progressTarget) * 100, 100) : (currentValue > 0 ? 100 : 0);

  const goalTypeColor = (() => {
    if (!goal) return undefined;
    if (goal.goalType === "habitual") return habitualColor;
    if (goal.goalType === "target") return targetColor;
    if (goal.goalType === "outcome") return outcomeColor;
    return undefined;
  })();

  const pillarColor = pillar?.color || "#6B7280";

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  // ---- Actions ----
  const saveDescription = async () => {
    if (description === (task.description || "")) return;
    await fetch(`/api/tasks/${id}?type=task`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    });
    setTask({ ...task, description });
  };

  const completeTask = async (completed: boolean, value?: number) => {
    const body: Record<string, unknown> = {
      taskId: task.id,
      date: taskDate || today,
      completed,
    };
    if (value !== undefined) body.value = value;
    const res = await fetch("/api/tasks/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const result = await res.json();
      setTask({
        ...task,
        completed: result.completed,
        value: result.value,
        pointsEarned: result.pointsEarned,
      });
    }
  };

  const handleCheckboxToggle = () => {
    completeTask(!isCompleted, !isCompleted ? 1 : 0);
  };

  const handleCountChange = (delta: number) => {
    const newVal = Math.max(0, currentValue + delta);
    const done = task.target != null && task.target > 0 && newVal >= task.target;
    completeTask(done, newVal);
  };

  const handleNumericSubmit = () => {
    const val = parseFloat(pendingNumeric) || 0;
    completeTask(val > 0, val);
    setPendingNumeric("");
  };

  const handleTimerToggle = () => {
    // Toggle timer via the complete endpoint
    if (timerRunning) {
      setTimerRunning(false);
      const minutes = timerElapsed / 60;
      const done = task.target != null && task.target > 0 && minutes >= task.target;
      completeTask(done, minutes);
    } else {
      setTimerRunning(true);
      // Start timer by posting to complete with timerStartedAt
      fetch("/api/tasks/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          date: taskDate || today,
          completed: false,
          timerStart: true,
        }),
      });
    }
  };

  const handleDurationManualSubmit = () => {
    const val = parseFloat(pendingNumeric) || 0;
    setTimerElapsed(val * 60);
    setTimerRunning(false);
    completeTask(task.target != null && task.target > 0 && val >= task.target, val);
    setPendingNumeric("");
  };

  const handleSkipToggle = async () => {
    const newSkipped = !isSkipped;
    await fetch("/api/tasks/skip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, skipped: newSkipped }),
    });
    setTask({ ...task, skipped: newSkipped } as Task & { skipped: boolean });
  };

  const handleHighlightToggle = async () => {
    const newHighlighted = !isHighlighted;
    await fetch("/api/tasks/highlight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, date: taskDate, isHighlighted: newHighlighted }),
    });
    setTask({ ...task, isHighlighted: newHighlighted } as Task & { isHighlighted: boolean });
  };

  const handleDelete = async () => {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    router.push("/tasks");
  };

  const handleMoveDate = async (newDate: string) => {
    const previousDate = task.date || task.startDate || '';
    const nextOriginalDate = task.originalDate || previousDate || null;
    // Optimistic: flip immediately so UI feedback is instant
    setTask({ ...task, date: newDate, startDate: newDate, originalDate: nextOriginalDate });
    const res = await fetch(`/api/tasks/${id}?type=task`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: newDate }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTask(prev => prev ? { ...prev, ...updated, startDate: updated.date || prev.startDate } : prev);
    }
  };

  const handleBasePointsChange = async (delta: number) => {
    const newPoints = Math.max(1, (task.basePoints || 0) + delta);
    if (newPoints === task.basePoints) return;
    setTask({ ...task, basePoints: newPoints });
    await fetch(`/api/tasks/${id}?type=task`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ basePoints: newPoints }),
    });
  };

  const handleDuplicate = async () => {
    if (duplicating) return;
    setDuplicating(true);
    const isRecurring = !!(task.frequency && task.frequency !== 'adhoc');
    const body: Record<string, unknown> = {
      pillarId: task.pillarId || null,
      name: `${task.name} (copy)`,
      completionType: task.completionType,
      target: task.target,
      unit: task.unit,
      basePoints: task.basePoints,
      goalId: task.goalId || null,
      flexibilityRule: task.flexibilityRule || "must_today",
      description: task.description || null,
    };
    if (isRecurring) {
      body.frequency = task.frequency;
      body.customDays = task.customDays;
      body.repeatInterval = task.repeatInterval;
      body.startDate = task.startDate || null;
      body.endDate = task.endDate || null;
    } else {
      body.frequency = 'adhoc';
      body.startDate = taskDate || null;
    }
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const newTask = await res.json();
        if (isRecurring) {
          // POST returns the schedule row; go back to the list so the user
          // sees the newly generated task instances.
          router.push("/tasks");
        } else {
          router.push(`/tasks/${newTask.taskId || newTask.id}`);
        }
      } else {
        setDuplicating(false);
      }
    } catch {
      setDuplicating(false);
    }
  };

  const preponeDate = () => {
    if (!taskDate) return;
    const d = new Date(taskDate + "T12:00:00");
    d.setDate(d.getDate() - 1);
    handleMoveDate(d.toISOString().split("T")[0]);
  };

  const postponeDate = () => {
    if (!taskDate) return;
    const d = new Date(taskDate + "T12:00:00");
    d.setDate(d.getDate() + 1);
    handleMoveDate(d.toISOString().split("T")[0]);
  };

  const moveToToday = () => handleMoveDate(today);
  const moveToTomorrow = () => {
    const d = new Date(today + "T12:00:00");
    d.setDate(d.getDate() + 1);
    handleMoveDate(d.toISOString().split("T")[0]);
  };

  // ---- Frozen view ----
  if (isFrozen) {
    return (
      <div className="container mx-auto px-4 py-4 md:py-8 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push("/tasks")}
            className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
          >
            <FaArrowLeft />
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white truncate">
            {task.name}
          </h1>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 mb-6">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            This task is from {taskDate ? formatDate(taskDate, dateFormat) : "an earlier date"} and is read-only.
          </p>
        </div>

        <div
          className="bg-white dark:bg-zinc-800 rounded-xl p-6 border border-zinc-200 dark:border-zinc-700"
          style={{
            borderLeftWidth: 4,
            borderLeftColor: pillarColor,
            ...(goalTypeColor ? { borderRightWidth: 4, borderRightColor: goalTypeColor } : {}),
          }}
        >
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {pillar && (
              <span
                className="text-xs px-2 py-1 rounded-full font-medium"
                style={{ backgroundColor: pillarColor + "20", color: pillarColor }}
              >
                {pillar.emoji} {pillar.name}
              </span>
            )}
            <span className="text-xs px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 font-medium">
              {task.completionType}
            </span>
            {taskDate && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {formatDate(taskDate, dateFormat)}
              </span>
            )}
            {!(goal && (goal.goalType === 'target' || goal.goalType === 'outcome')) && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {task.basePoints} pts
              </span>
            )}
            {isCompleted && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">
                Completed
              </span>
            )}
            {isSkipped && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">
                Skipped
              </span>
            )}
          </div>

          {task.description && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">{task.description}</p>
          )}

          {currentValue > 0 && (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Value: {currentValue}{task.unit ? ` ${task.unit}` : ""}{task.target ? ` / ${task.target}` : ""}
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-4 py-2 text-sm rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 flex items-center gap-2"
          >
            <FaTrash className="text-xs" /> Delete
          </button>
        </div>

        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setConfirmDelete(false)}>
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl p-6 mx-4 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
              <p className="text-sm text-zinc-900 dark:text-white mb-4">Permanently delete this task?</p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-4 py-2 text-sm rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---- Normal view ----
  const progressColor = isLimitTask && currentValue > limitVal ? "#ef4444" : pillarColor;
  const isRecurring = !!(task.frequency && task.frequency !== 'adhoc');
  const wasPostponed = !!(task.originalDate && task.date && task.originalDate !== task.date);
  const dateValue = taskDate ? formatDate(taskDate, dateFormat) : '—';
  const hasEndDate = !!(isRecurring && task.endDate);
  const pointsValue = `${task.basePoints} pts`;
  type Cell = { label: string; value: string; valueClass?: string; onClick?: () => void; render?: React.ReactNode; hint?: string; hintClass?: string };
  const scheduleCell: Cell = isRecurring
    ? { label: 'Schedule', value: task.frequency.charAt(0).toUpperCase() + task.frequency.slice(1) }
    : goal
      ? {
          label: 'Goal-based',
          value: goal.name,
          valueClass: 'hover:opacity-80 transition-opacity',
          onClick: () => router.push(`/goals/${goal.id}`),
        }
      : { label: 'Schedule', value: 'One-off' };
  const cells: Cell[] = [
    scheduleCell,
    { label: 'Type', value: task.completionType.charAt(0).toUpperCase() + task.completionType.slice(1) },
    {
      label: wasPostponed ? 'Planned' : 'Date',
      value: dateValue,
      render: taskDate ? (
        <div>
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); preponeDate(); }}
              className="w-6 h-6 rounded-md bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600 flex items-center justify-center shrink-0"
              aria-label="Prepone one day"
            >
              <FaChevronLeft className="text-[9px]" />
            </button>
            <span className={`text-sm font-medium truncate tabular-nums ${wasPostponed ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-900 dark:text-white'}`}>
              {dateValue}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); postponeDate(); }}
              className="w-6 h-6 rounded-md bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600 flex items-center justify-center shrink-0"
              aria-label="Postpone one day"
            >
              <FaChevronRight className="text-[9px]" />
            </button>
          </div>
          {wasPostponed && task.originalDate && (
            <div className="text-[11px] mt-1 text-center line-through text-zinc-500 dark:text-zinc-400 truncate">
              was {formatDate(task.originalDate, dateFormat)}
            </div>
          )}
        </div>
      ) : undefined,
    },
    {
      label: 'Points',
      value: pointsValue,
      render: (
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleBasePointsChange(-1); }}
            className="w-6 h-6 rounded-md bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600 flex items-center justify-center shrink-0"
            aria-label="Decrease points"
          >
            <FaMinus className="text-[9px]" />
          </button>
          <span className="text-sm font-medium text-zinc-900 dark:text-white tabular-nums">
            {task.basePoints} pts
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); handleBasePointsChange(1); }}
            className="w-6 h-6 rounded-md bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 flex items-center justify-center shrink-0"
            aria-label="Increase points"
          >
            <FaPlus className="text-[9px]" />
          </button>
        </div>
      ),
    },
    ...(hasEndDate ? [{ label: 'Ends', value: formatDate(task.endDate!, dateFormat) }] : []),
  ];
  // Pad to even number so grid-cols-2 lays out cleanly
  if (cells.length % 2 !== 0) cells.push({ label: '', value: '' });
  const titleStateClass = isCompleted
    ? "line-through text-zinc-400 dark:text-zinc-500"
    : isSkipped
      ? "line-through text-amber-500 dark:text-amber-400"
      : "text-zinc-900 dark:text-white";

  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <button
          onClick={() => router.push("/tasks")}
          className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 shrink-0"
        >
          <FaArrowLeft />
        </button>
        <div className="flex items-center gap-1">
          {taskDate && (
            <button
              onClick={handleHighlightToggle}
              title={isHighlighted ? "Unstar" : "Star"}
              className={`p-2 rounded-lg transition-colors ${
                isHighlighted
                  ? "text-amber-500 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20"
                  : "text-zinc-400 hover:text-amber-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {isHighlighted ? <FaStar /> : <FaRegStar />}
            </button>
          )}
          <button
            onClick={handleDuplicate}
            disabled={duplicating}
            title="Duplicate"
            className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FaCopy className={duplicating ? 'animate-pulse' : ''} />
          </button>
          <button
            onClick={handleSkipToggle}
            title={isSkipped ? "Unskip" : "Skip"}
            className={`p-2 rounded-lg transition-colors ${
              isSkipped
                ? "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
            }`}
          >
            <FaTimes />
          </button>
          <button
            onClick={() => router.push(`/tasks/${id}/edit`)}
            title="Edit"
            className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
          >
            <FaEdit />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            title="Delete"
            className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            <FaTrash />
          </button>
        </div>
      </div>

      {/* Hero card */}
      <div
        className="relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 mb-4 shadow-sm"
      >
        {/* Pillar color tint */}
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{ backgroundColor: pillarColor }}
        />
        <div
          className="absolute inset-x-0 top-0 h-24 pointer-events-none"
          style={{ background: `linear-gradient(180deg, ${pillarColor}14 0%, transparent 100%)` }}
        />

        <div className="relative p-5 md:p-6">
          {/* Pillar + goal chips */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {pillar && (
              <span
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium"
                style={{ backgroundColor: pillarColor + "1f", color: pillarColor }}
              >
                <span>{pillar.emoji}</span>
                <span>{pillar.name}</span>
              </span>
            )}
            {goal && (
              <button
                onClick={() => router.push(`/goals/${goal.id}`)}
                className="text-xs px-2.5 py-1 rounded-full font-medium hover:opacity-80 transition-opacity"
                style={{
                  backgroundColor: (goalTypeColor || "#6B7280") + "1f",
                  color: goalTypeColor || "#6B7280",
                }}
              >
                {goal.name}
              </button>
            )}
            {isLimitTask && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 font-medium">
                Limit
              </span>
            )}
            {isCompleted && (
              <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400 font-medium">
                <FaCheck className="text-[9px]" /> Done
              </span>
            )}
            {isSkipped && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 font-medium">
                Skipped
              </span>
            )}
          </div>

          {/* Task name */}
          <h1 className={`text-2xl md:text-3xl font-bold leading-tight ${titleStateClass}`}>
            {task.name}
          </h1>

          {/* Description — click to edit */}
          {editingDescription ? (
            <textarea
              autoFocus
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => { saveDescription(); setEditingDescription(false); }}
              onKeyDown={(e) => { if (e.key === 'Escape') { setDescription(task.description || ''); setEditingDescription(false); } }}
              rows={3}
              className="w-full px-3 py-2 mt-3 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-600"
            />
          ) : (
            <div
              onClick={() => setEditingDescription(true)}
              className="mt-2 cursor-pointer rounded-lg -mx-2 px-2 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-700/40 transition-colors"
            >
              {description ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed">{description}</p>
              ) : (
                <p className="text-sm text-zinc-400 dark:text-zinc-500 italic">Add a description…</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Completion card */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-5 md:p-6 mb-4 shadow-sm">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Progress
          </h2>
          {progressTarget > 0 && (
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {Math.round(progressPct)}%
            </span>
          )}
        </div>

        {task.completionType === "checkbox" && (
          <button
            onClick={handleCheckboxToggle}
            className={`w-full py-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
              isCompleted
                ? "bg-green-500 text-white hover:bg-green-600 shadow-sm shadow-green-500/30"
                : "bg-zinc-100 dark:bg-zinc-700/60 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            <FaCheck /> {isCompleted ? "Completed" : "Mark as Done"}
          </button>
        )}

        {task.completionType === "count" && (
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => handleCountChange(-1)}
              className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-700/60 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
            >
              <FaMinus />
            </button>
            <div className="text-center flex-1 min-w-0">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-white tabular-nums">
                  {currentValue}
                </span>
                {task.target && task.target > 0 && (
                  <span className="text-xl text-zinc-400 dark:text-zinc-500 tabular-nums">
                    / {task.target}
                  </span>
                )}
              </div>
              {task.unit && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{task.unit}</span>
              )}
            </div>
            <button
              onClick={() => handleCountChange(1)}
              className="w-14 h-14 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
            >
              <FaPlus />
            </button>
          </div>
        )}

        {task.completionType === "numeric" && (
          <div>
            <div className="text-center mb-4">
              <span className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-white tabular-nums">
                {currentValue || 0}
              </span>
              {task.target && task.target > 0 && (
                <span className="text-xl text-zinc-400 dark:text-zinc-500 tabular-nums ml-1">
                  / {task.target}
                </span>
              )}
              {task.unit && (
                <span className="block text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mt-1">{task.unit}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={pendingNumeric}
                onChange={(e) => setPendingNumeric(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleNumericSubmit()}
                placeholder={task.target ? `Enter value (target ${task.target})` : "Enter value"}
                className="min-w-0 flex-1 px-3 py-2.5 text-base border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-600"
              />
              <button
                onClick={handleNumericSubmit}
                className="px-4 py-2.5 rounded-lg bg-green-500 text-white hover:bg-green-600 font-medium shrink-0 transition-colors"
              >
                <FaCheck />
              </button>
            </div>
          </div>
        )}

        {task.completionType === "duration" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-center flex-1 min-w-0">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl md:text-5xl font-mono font-bold text-zinc-900 dark:text-white tabular-nums">
                    {formatTime(timerElapsed)}
                  </span>
                  {task.target && task.target > 0 && (
                    <span className="text-xl font-mono text-zinc-400 dark:text-zinc-500 tabular-nums">
                      / {task.target}:00
                    </span>
                  )}
                </div>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">minutes</span>
              </div>
              <button
                onClick={handleTimerToggle}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shrink-0 ${
                  timerRunning
                    ? "bg-amber-500 text-white hover:bg-amber-600 shadow-sm shadow-amber-500/30"
                    : "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100"
                }`}
              >
                {timerRunning ? <FaPause /> : <FaPlay className="ml-0.5" />}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={pendingNumeric}
                onChange={(e) => setPendingNumeric(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleDurationManualSubmit()}
                placeholder="Set manually (min)"
                className="flex-1 px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-600"
              />
              <button
                onClick={handleDurationManualSubmit}
                className="px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-sm font-medium transition-colors"
              >
                Set
              </button>
            </div>
          </div>
        )}

        {/* Progress bar */}
        {progressTarget > 0 && (
          <div className="mt-5">
            <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-700/60 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%`, backgroundColor: progressColor }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Meta grid */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 overflow-hidden mb-4 shadow-sm">
        <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 dark:divide-zinc-700">
          {cells.map((c, i) => (
            <MetaCell
              key={i}
              label={c.label}
              value={c.value}
              valueClass={c.onClick && goalTypeColor ? undefined : c.valueClass}
              valueStyle={c.onClick && goalTypeColor ? { color: goalTypeColor } : undefined}
              onClick={c.onClick}
              render={c.render}
              hint={c.hint}
              hintClass={c.hintClass}
            />
          ))}
        </div>
      </div>

      {/* Actions — only for no-date tasks */}
      {!taskDate && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3 md:p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-2">
            <ActionButton icon={<FaArrowRight />} label="To Today" onClick={moveToToday} iconRight />
            <ActionButton icon={<FaArrowRight />} label="To Tomorrow" onClick={moveToTomorrow} iconRight />
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setConfirmDelete(false)}>
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-6 mx-4 max-w-sm w-full border border-zinc-200 dark:border-zinc-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-2">Delete task?</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">This can&apos;t be undone.</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetaCell({ label, value, valueClass, valueStyle, onClick, render, hint, hintClass }: {
  label: string;
  value: string;
  valueClass?: string;
  valueStyle?: React.CSSProperties;
  onClick?: () => void;
  render?: React.ReactNode;
  hint?: string;
  hintClass?: string;
}) {
  return (
    <div
      className={`px-4 py-3 ${onClick ? 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700/40 transition-colors' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-0.5">
        {label || ' '}
      </div>
      {render ? render : (
        <>
          <div
            className={`text-sm font-medium truncate ${valueClass || (valueStyle ? '' : 'text-zinc-900 dark:text-white')}`}
            style={valueStyle}
          >
            {value || ' '}
          </div>
          {hint && (
            <div className={`text-[11px] mt-0.5 truncate ${hintClass || 'text-zinc-500 dark:text-zinc-400'}`}>
              {hint}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  variant = "default",
  iconRight = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "amber" | "danger";
  iconRight?: boolean;
}) {
  const variantClass =
    variant === "danger"
      ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20"
      : variant === "amber"
        ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20"
        : "text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-700/50 hover:bg-zinc-100 dark:hover:bg-zinc-700";
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2.5 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors ${variantClass}`}
    >
      {!iconRight && <span className="text-[11px]">{icon}</span>}
      <span>{label}</span>
      {iconRight && <span className="text-[11px]">{icon}</span>}
    </button>
  );
}
