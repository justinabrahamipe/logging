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
} from "react-icons/fa";
import { useTheme } from "@/components/ThemeProvider";
import { formatDate, getTodayString, getYesterdayString } from "@/lib/format";
import type { Task, Pillar, Outcome } from "@/lib/types";

export default function TaskDetailPage() {
  const { data: session, status } = useSession();
  const { habitualColor, targetColor, outcomeColor, dateFormat } = useTheme();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [task, setTask] = useState<Task | null>(null);
  const [pillar, setPillar] = useState<Pillar | null>(null);
  const [goal, setGoal] = useState<Outcome | null>(null);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingNumeric, setPendingNumeric] = useState("");
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerElapsed, setTimerElapsed] = useState(0);
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
      body: JSON.stringify({ taskId: task.id, highlighted: newHighlighted }),
    });
    setTask({ ...task, isHighlighted: newHighlighted } as Task & { isHighlighted: boolean });
  };

  const handleDelete = async () => {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    router.push("/tasks");
  };

  const handleMoveDate = async (newDate: string) => {
    await fetch(`/api/tasks/${id}?type=task`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: newDate }),
    });
    setTask({ ...task, date: newDate, startDate: newDate });
  };

  const handleDuplicate = async () => {
    const body = {
      pillarId: task.pillarId || null,
      name: task.name,
      completionType: task.completionType,
      target: task.target,
      unit: task.unit,
      basePoints: task.basePoints,
      goalId: task.goalId,
      flexibilityRule: task.flexibilityRule || "must_today",
      startDate: taskDate || null,
      description: task.description || null,
    };
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const newTask = await res.json();
      router.push(`/tasks/${newTask.id || newTask.taskId}`);
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
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {task.basePoints} pts
            </span>
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
  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/tasks")}
          className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
        >
          <FaArrowLeft />
        </button>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">Tasks</span>
      </div>

      {/* Main card */}
      <div
        className="bg-white dark:bg-zinc-800 rounded-xl p-6 border border-zinc-200 dark:border-zinc-700 mb-6"
        style={{
          borderLeftWidth: 4,
          borderLeftColor: pillarColor,
          ...(goalTypeColor ? { borderRightWidth: 4, borderRightColor: goalTypeColor } : {}),
        }}
      >
        {/* Task name */}
        <h1 className={`text-2xl md:text-3xl font-bold mb-4 ${isCompleted ? "line-through text-zinc-400 dark:text-zinc-500" : isSkipped ? "line-through text-amber-500" : "text-zinc-900 dark:text-white"}`}>
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
            className="w-full px-3 py-2 mb-4 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white resize-none focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500"
          />
        ) : (
          <div
            onClick={() => !isFrozen && setEditingDescription(true)}
            className={`mb-4 ${!isFrozen ? 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700/50 rounded-lg px-3 py-2 -mx-3' : ''}`}
          >
            {description ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">{description}</p>
            ) : !isFrozen ? (
              <p className="text-sm text-zinc-400 dark:text-zinc-500 italic">Add a description...</p>
            ) : null}
          </div>
        )}

        {/* Metadata pills */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {pillar && (
            <span
              className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{ backgroundColor: pillarColor + "20", color: pillarColor }}
            >
              {pillar.emoji} {pillar.name}
            </span>
          )}
          <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 font-medium">
            {task.completionType}
          </span>
          {task.frequency && task.frequency !== "adhoc" && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 font-medium">
              {task.frequency}
            </span>
          )}
          {taskDate && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 font-medium">
              {formatDate(taskDate, dateFormat)}
            </span>
          )}
          <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 font-medium">
            {task.basePoints} pts
          </span>
          {isLimitTask && (
            <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 font-medium">
              Limit
            </span>
          )}
          {goal && (
            <button
              onClick={() => router.push(`/goals/${goal.id}`)}
              className="text-xs px-2.5 py-1 rounded-full font-medium hover:opacity-80 transition-opacity"
              style={{
                backgroundColor: (goalTypeColor || "#6B7280") + "20",
                color: goalTypeColor || "#6B7280",
              }}
            >
              {goal.name}
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-zinc-200 dark:border-zinc-700 my-6" />

        {/* Completion section */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Completion</h2>

          {task.completionType === "checkbox" && (
            <button
              onClick={handleCheckboxToggle}
              className={`w-full py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                isCompleted
                  ? "bg-green-500 text-white hover:bg-green-600"
                  : "bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600"
              }`}
            >
              <FaCheck /> {isCompleted ? "Completed" : "Mark as Done"}
            </button>
          )}

          {task.completionType === "count" && (
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => handleCountChange(-1)}
                className="w-12 h-12 rounded-xl bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300"
              >
                <FaMinus />
              </button>
              <div className="text-center">
                <span className="text-3xl font-bold text-zinc-900 dark:text-white">
                  {currentValue}
                </span>
                {task.target && task.target > 0 && (
                  <span className="text-lg text-zinc-400 dark:text-zinc-500">
                    {" "}/ {task.target}
                  </span>
                )}
                {task.unit && (
                  <span className="text-sm text-zinc-500 dark:text-zinc-400 ml-1">{task.unit}</span>
                )}
              </div>
              <button
                onClick={() => handleCountChange(1)}
                className="w-12 h-12 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center hover:bg-zinc-800 dark:hover:bg-zinc-100"
              >
                <FaPlus />
              </button>
            </div>
          )}

          {task.completionType === "numeric" && (
            <div className="flex items-center gap-2 max-w-full overflow-hidden">
              <input
                type="number"
                value={pendingNumeric || (currentValue || "")}
                onChange={(e) => setPendingNumeric(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleNumericSubmit()}
                placeholder={task.target ? String(task.target) : "0"}
                className="min-w-0 flex-1 px-3 py-2.5 text-lg text-center border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
              />
              {task.unit && (
                <span className="text-sm text-zinc-500 dark:text-zinc-400 shrink-0">{task.unit}</span>
              )}
              <button
                onClick={handleNumericSubmit}
                className="px-3 py-2.5 rounded-lg bg-green-500 text-white hover:bg-green-600 font-medium shrink-0"
              >
                <FaCheck />
              </button>
            </div>
          )}

          {task.completionType === "duration" && (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <span className="text-3xl font-mono font-bold text-zinc-900 dark:text-white">
                    {formatTime(timerElapsed)}
                  </span>
                  {task.target && task.target > 0 && (
                    <span className="text-lg font-mono text-zinc-400 dark:text-zinc-500">
                      {" "}/ {task.target}:00
                    </span>
                  )}
                </div>
                <button
                  onClick={handleTimerToggle}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                    timerRunning
                      ? "bg-amber-500 text-white hover:bg-amber-600"
                      : "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100"
                  }`}
                >
                  {timerRunning ? <FaPause /> : <FaPlay />}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={pendingNumeric}
                  onChange={(e) => setPendingNumeric(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleDurationManualSubmit()}
                  placeholder="Manual (min)"
                  className="flex-1 px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                />
                <button
                  onClick={handleDurationManualSubmit}
                  className="px-3 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 text-sm"
                >
                  Set
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {progressTarget > 0 && (
          <div className="mb-6">
            <div className="w-full h-2.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: isLimitTask && currentValue > limitVal ? "#ef4444" : "#22c55e",
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              <span>{currentValue}{task.unit ? ` ${task.unit}` : ""}</span>
              <span>{progressTarget}{task.unit ? ` ${task.unit}` : ""}</span>
            </div>
          </div>
        )}

        {/* Status badges */}
        <div className="flex flex-wrap gap-2 mb-2">
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
          {isHighlighted && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">
              Highlighted
            </span>
          )}
        </div>
      </div>

      {/* Actions row */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => router.push(`/tasks/${id}/edit`)}
            className="px-3 py-2 text-xs rounded-lg flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 font-medium"
          >
            <FaEdit className="text-[10px]" /> Edit
          </button>

          {taskDate ? (
            <>
              <button
                onClick={preponeDate}
                className="px-3 py-2 text-xs rounded-lg flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 font-medium"
              >
                <FaArrowLeft className="text-[9px]" /> Prepone
              </button>
              <button
                onClick={postponeDate}
                className="px-3 py-2 text-xs rounded-lg flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 font-medium"
              >
                Postpone <FaArrowRight className="text-[9px]" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={moveToToday}
                className="px-3 py-2 text-xs rounded-lg flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 font-medium"
              >
                <FaArrowRight className="text-[9px]" /> Today
              </button>
              <button
                onClick={moveToTomorrow}
                className="px-3 py-2 text-xs rounded-lg flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 font-medium"
              >
                <FaArrowRight className="text-[9px]" /> Tomorrow
              </button>
            </>
          )}

          <button
            onClick={handleDuplicate}
            className="px-3 py-2 text-xs rounded-lg flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 font-medium"
          >
            <FaCopy className="text-[10px]" /> Duplicate
          </button>

          <button
            onClick={handleSkipToggle}
            className={`px-3 py-2 text-xs rounded-lg flex items-center gap-1.5 font-medium ${
              isSkipped
                ? "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                : "text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600"
            }`}
          >
            <FaTimes className="text-[10px]" /> {isSkipped ? "Unskip" : "Skip"}
          </button>

          <button
            onClick={handleHighlightToggle}
            className={`px-3 py-2 text-xs rounded-lg flex items-center gap-1.5 font-medium ${
              isHighlighted
                ? "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                : "text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600"
            }`}
          >
            {isHighlighted ? <FaStar className="text-[10px]" /> : <FaRegStar className="text-[10px]" />}
            {isHighlighted ? "Unstar" : "Star"}
          </button>

          <button
            onClick={() => setConfirmDelete(true)}
            className="px-3 py-2 text-xs rounded-lg flex items-center gap-1.5 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 font-medium"
          >
            <FaTrash className="text-[10px]" /> Delete
          </button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
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
