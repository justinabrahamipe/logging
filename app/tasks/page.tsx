"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPlus, FaEdit, FaTrash, FaCheck, FaMinus, FaPlay, FaStop, FaEllipsisV, FaCopy, FaChevronDown, FaStar, FaTimes, FaArrowLeft, FaArrowRight } from "react-icons/fa";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Snackbar, Alert as MuiAlert } from "@mui/material";
import { DEMO_TASK_GROUPS, DEMO_PILLARS } from "@/lib/demo-data";
import { useTheme } from "@/components/ThemeProvider";
import { formatDate } from "@/lib/format";

interface Pillar {
  id: number;
  name: string;
  emoji: string;
  color: string;
}

interface TaskCompletion {
  id: number;
  taskId: number;
  completed: boolean;
  value: number | null;
  pointsEarned: number;
  isHighlighted: boolean;
}

interface Outcome {
  id: number;
  pillarId: number | null;
  name: string;
  goalType: string;
}

interface Cycle {
  id: number;
  name: string;
  isActive: boolean;
}

interface Task {
  id: number;
  pillarId: number;
  name: string;
  completionType: string;
  target: number | null;
  unit: string | null;
  frequency: string;
  customDays: string | null;
  repeatInterval: number | null;
  isWeekendTask: boolean;
  basePoints: number;
  goalId: number | null;
  periodId: number | null;
  startDate: string | null;
  completion?: TaskCompletion | null;
}

interface TaskGroup {
  pillar: Pillar;
  tasks: Task[];
}

interface ScoreSummary {
  actionScore: number;
  scoreTier: string;
  completedTasks: number;
  totalTasks: number;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDateBucket(task: { frequency: string; customDays?: string | null; createdAt?: unknown; repeatInterval?: number | null; startDate?: string | null }, todayStr: string): string {
  // For daily tasks with no future startDate, bucket as "Today"
  if (task.frequency === 'daily' && (!task.startDate || task.startDate <= todayStr)) return 'Today';

  const today = new Date(todayStr + 'T12:00:00');
  const todayDay = today.getDay();

  // Find next occurrence within 60 days
  for (let i = 0; i <= 60; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dStr = d.toISOString().split('T')[0];

    // Skip dates before task's startDate
    if (task.startDate && dStr < task.startDate) continue;

    // Inline check (simplified version of isTaskForExactDate)
    let matches = false;
    const dow = d.getDay();
    if (task.frequency === 'adhoc') {
      if (!task.startDate) return 'No Date';
      matches = dStr === task.startDate;
    } else if (task.frequency === 'custom' && task.customDays) {
      try {
        const days: number[] = JSON.parse(task.customDays);
        matches = days.includes(dow);
      } catch { matches = false; }
    } else if (task.frequency === 'monthly' && task.customDays) {
      try {
        const days: number[] = JSON.parse(task.customDays);
        matches = days.includes(d.getDate());
      } catch { matches = false; }
    } else if (task.frequency === 'interval' && task.repeatInterval && task.createdAt) {
      const created = new Date(task.createdAt as string | number | Date);
      const diffMs = d.getTime() - new Date(created.toISOString().split('T')[0] + 'T12:00:00').getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      matches = diffDays >= 0 && diffDays % task.repeatInterval === 0;
    } else if (task.frequency === 'weekly') {
      matches = dow === 1;
    }

    if (!matches) continue;

    if (i === 0) return 'Today';
    if (i === 1) return 'Tomorrow';

    // Days 2-6: individual date buckets (YYYY-MM-DD format used as key)
    if (i <= 6) return dStr;

    return 'Later';
  }
  return 'No Date';
}

function taskToPreset(task: { frequency: string; customDays?: string | null; repeatInterval?: number | null }): {
  preset: string; repeatInterval: string; repeatUnit: 'days' | 'weeks' | 'months'; customDays: number[]; monthDay: number
} {
  const customDays = task.customDays ? JSON.parse(task.customDays) : [];

  if (task.frequency === 'adhoc') return { preset: 'adhoc', repeatInterval: '1', repeatUnit: 'days', customDays: [], monthDay: 1 };
  if (task.frequency === 'daily') return { preset: 'daily', repeatInterval: '1', repeatUnit: 'days', customDays: [], monthDay: 1 };

  // Check if it's a weekdays preset
  if (task.frequency === 'custom' && !task.repeatInterval) {
    const sorted = [...customDays].sort().join(',');
    if (sorted === '1,2,3,4,5') return { preset: 'weekdays', repeatInterval: '1', repeatUnit: 'weeks', customDays, monthDay: 1 };
  }

  if (task.frequency === 'weekly') {
    return { preset: 'custom', repeatInterval: '1', repeatUnit: 'weeks', customDays: [1], monthDay: 1 };
  }

  if (task.frequency === 'custom') {
    const weekInterval = task.repeatInterval ? Math.round(task.repeatInterval / 7) : 1;
    return { preset: 'custom', repeatInterval: weekInterval.toString(), repeatUnit: 'weeks', customDays, monthDay: 1 };
  }

  if (task.frequency === 'monthly') {
    return { preset: 'custom', repeatInterval: (task.repeatInterval || 1).toString(), repeatUnit: 'months', customDays: [], monthDay: customDays[0] || 1 };
  }

  if (task.frequency === 'interval') {
    return { preset: 'custom', repeatInterval: (task.repeatInterval || 1).toString(), repeatUnit: 'days', customDays: [], monthDay: 1 };
  }

  return { preset: 'daily', repeatInterval: '1', repeatUnit: 'days', customDays: [], monthDay: 1 };
}

export default function TasksPage() {
  const { data: session, status } = useSession();
  const { dateFormat } = useTheme();
  const router = useRouter();
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [goalsList, setGoalsList] = useState<Outcome[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pastDays, setPastDays] = useState<{ date: string; tasks: { id: number; name: string; completionType: string; target: number | null; unit: string | null; goalId: number | null; pillarName: string | null; pillarColor: string | null; pillarEmoji: string | null; completed: boolean; value: number | null; isHighlighted: boolean }[] }[]>([]);
  const [pastPending, setPastPending] = useState<Record<string, string>>({});
  const [pastLoading, setPastLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'done'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tasks-status-filter');
      if (saved === 'all' || saved === 'todo' || saved === 'done') return saved;
    }
    return 'all';
  });
  const [openSchedules, setOpenSchedules] = useState<Set<string>>(new Set(['Today']));
  const [scoreSummary, setScoreSummary] = useState<ScoreSummary | null>(null);
  const [timers, setTimers] = useState<Record<number, { running: boolean; elapsed: number; interval?: NodeJS.Timeout }>>({});
  const [pendingValues, setPendingValues] = useState<Record<number, string>>({});
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});
  const pastFetchedRef = useRef(false);
  const [authSnackbar, setAuthSnackbar] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const today = new Date().toISOString().split('T')[0];

  // Save statusFilter to localStorage
  useEffect(() => {
    localStorage.setItem('tasks-status-filter', statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    if (status === "unauthenticated") {
      // Load demo data for non-logged-in users
      setPillars(DEMO_PILLARS.map(p => ({ id: p.id, name: p.name, emoji: p.emoji, color: p.color })));
      setGroups(DEMO_TASK_GROUPS.map(g => ({
        pillar: { id: g.pillarId, name: g.pillarName, emoji: g.pillarEmoji, color: g.pillarColor },
        tasks: g.tasks.map(t => ({
          ...t, frequency: t.frequency, customDays: null, repeatInterval: null,
          isWeekendTask: false, goalId: null, periodId: null, startDate: null,
          completion: t.completed ? { id: 0, taskId: t.id, completed: true, value: t.value, pointsEarned: t.basePoints, isHighlighted: false } : null,
        })),
      })) as TaskGroup[]);
      setLoading(false);
      return;
    }
    if (session?.user?.id) {
      fetchPillars();
      fetchOutcomes();
      fetchCycles();
      fetchTasks();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status]);

  const fetchPillars = async () => {
    try {
      const res = await fetch('/api/pillars');
      if (res.ok) {
        setPillars(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch pillars:", error);
    }
  };

  const fetchOutcomes = async () => {
    try {
      const res = await fetch('/api/outcomes');
      if (res.ok) {
        const data = await res.json();
        setGoalsList(data.map((o: Outcome & { pillarId: number | null; goalType: string }) => ({ id: o.id, pillarId: o.pillarId, name: o.name, goalType: o.goalType || 'outcome' })));
      }
    } catch (error) {
      console.error("Failed to fetch outcomes:", error);
    }
  };

  const fetchCycles = async () => {
    try {
      const res = await fetch('/api/cycles');
      if (res.ok) {
        const data = await res.json();
        setCycles(data.map((c: Cycle) => ({ id: c.id, name: c.name, isActive: c.isActive })));
      }
    } catch (error) {
      console.error("Failed to fetch cycles:", error);
    }
  };

  const fetchTasks = async () => {
    try {
      if (!loading) setRefreshing(true);
      const url = `/api/tasks?date=${today}&all=true`;
      const res = await fetch(url);
      if (res.ok) {
        setGroups(await res.json());
      }
      await fetchScore();
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchScore = async () => {
    try {
      const res = await fetch(`/api/daily-score?date=${today}`);
      if (res.ok) {
        const data = await res.json();
        setScoreSummary({
          actionScore: data.actionScore,
          scoreTier: data.scoreTier,
          completedTasks: data.completedTasks,
          totalTasks: data.totalTasks,
        });
        // Invalidate header stats cache so it refreshes on next nav
        try { sessionStorage.removeItem('header-stats'); } catch { /* ignore */ }
      }
    } catch (error) {
      console.error("Failed to fetch score:", error);
    }
  };

  const updatePastTask = (date: string, taskId: number, updates: { completed?: boolean; value?: number | null }) => {
    setPastDays(prev => prev.map(day =>
      day.date !== date ? day : {
        ...day,
        tasks: day.tasks.map(t =>
          t.id !== taskId ? t : { ...t, ...updates }
        ),
      }
    ));
  };

  const handlePastComplete = async (date: string, taskId: number, completed: boolean, value?: number) => {
    updatePastTask(date, taskId, { completed, value: value ?? (completed ? 1 : 0) });
    const body: Record<string, unknown> = { taskId, date, completed };
    if (value !== undefined) body.value = value;
    await fetch('/api/tasks/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  };

  const handlePastCountChange = async (date: string, task: { id: number; target: number | null; completed: boolean; value: number | null }, delta: number) => {
    const newVal = Math.max(0, (task.value || 0) + delta);
    const done = task.target != null && task.target > 0 && newVal >= task.target;
    updatePastTask(date, task.id, { completed: done, value: newVal });
    await fetch('/api/tasks/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: task.id, date, value: newVal }),
    });
  };

  const handlePastNumericSubmit = async (date: string, task: { id: number; target: number | null }) => {
    const key = `${date}-${task.id}`;
    const val = parseFloat(pastPending[key] || '0');
    if (isNaN(val)) return;
    const done = task.target != null && task.target > 0 && val >= task.target;
    updatePastTask(date, task.id, { completed: done, value: val });
    setPastPending(prev => { const next = { ...prev }; delete next[key]; return next; });
    await fetch('/api/tasks/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: task.id, date, value: val }),
    });
  };

  const fetchPastTasks = async () => {
    setPastLoading(true);
    try {
      const res = await fetch('/api/tasks/history?limit=30');
      if (res.ok) setPastDays(await res.json());
    } catch (error) {
      console.error("Failed to fetch past tasks:", error);
    } finally {
      setPastLoading(false);
    }
  };

  // --- Completion handlers ---
  const handleComplete = useCallback((taskId: number, completed?: boolean, value?: number) => {
    if (status !== "authenticated") { setAuthSnackbar(true); return; }
    setGroups(prev => prev.map(g => ({
      ...g,
      tasks: g.tasks.map(t =>
        t.id === taskId ? { ...t, completion: { ...t.completion, taskId, completed: completed ?? false, value: value ?? null, pointsEarned: t.completion?.pointsEarned ?? 0, isHighlighted: t.completion?.isHighlighted ?? false } as TaskCompletion } : t
      ),
    })));

    const body: Record<string, unknown> = { taskId, date: today };
    if (completed !== undefined) body.completed = completed;
    if (value !== undefined) body.value = value;

    fetch('/api/tasks/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(res => {
      if (res.ok) {
        res.json().then(completion => {
          setGroups(prev => prev.map(g => ({
            ...g,
            tasks: g.tasks.map(t =>
              t.id === taskId ? { ...t, completion } : t
            ),
          })));
        });
        fetchScore();
      }
    }).catch(err => console.error("Failed to complete task:", err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  const handleCheckboxToggle = (task: Task) => {
    const isCurrentlyCompleted = task.completion?.completed || false;
    handleComplete(task.id, !isCurrentlyCompleted, !isCurrentlyCompleted ? 1 : 0);
  };

  const handleCountChange = (task: Task, delta: number) => {
    const current = task.completion?.value || 0;
    const newValue = Math.max(0, current + delta);
    const completed = task.target ? newValue >= task.target : newValue > 0;
    handleComplete(task.id, completed, newValue);
  };

  const handleNumericSubmit = (task: Task) => {
    const raw = pendingValues[task.id];
    if (raw === undefined) return;
    const numValue = parseFloat(raw) || 0;
    handleComplete(task.id, numValue > 0, numValue);
    setPendingValues(prev => { const next = { ...prev }; delete next[task.id]; return next; });
  };

  const startTimer = (taskId: number, startElapsed: number) => {
    const interval = setInterval(() => {
      setTimers(prev => {
        const current = prev[taskId];
        if (!current?.running) return prev;
        return { ...prev, [taskId]: { ...current, elapsed: current.elapsed + 1 } };
      });
    }, 1000);
    setTimers(prev => ({ ...prev, [taskId]: { running: true, elapsed: startElapsed, interval } }));
  };

  const handleTimerToggle = (task: Task) => {
    const timer = timers[task.id];
    if (timer?.running) {
      clearInterval(timer.interval);
      const minutes = Math.round(timer.elapsed / 60);
      handleComplete(task.id, minutes > 0, minutes);
      setTimers(prev => ({ ...prev, [task.id]: { running: false, elapsed: timer.elapsed } }));
    } else {
      const elapsed = timer?.elapsed || ((task.completion?.value || 0) * 60);
      startTimer(task.id, elapsed);
    }
  };

  const handleDurationManualSubmit = (task: Task) => {
    const raw = pendingValues[task.id];
    if (raw === undefined) return;
    const minutes = parseFloat(raw) || 0;
    setTimers(prev => ({ ...prev, [task.id]: { running: false, elapsed: minutes * 60 } }));
    handleComplete(task.id, minutes > 0, minutes);
    setPendingValues(prev => { const next = { ...prev }; delete next[task.id]; return next; });
  };

  const handleHighlightToggle = useCallback((taskId: number) => {
    const allTasks = groups.flatMap(g => g.tasks);
    const task = allTasks.find(t => t.id === taskId);
    const currentlyHighlighted = task?.completion?.isHighlighted || false;

    // Check max 3 before toggling on
    if (!currentlyHighlighted) {
      const highlightedCount = allTasks.filter(t => t.completion?.isHighlighted).length;
      if (highlightedCount >= 3) return;
    }

    // Optimistic update
    setGroups(prev => prev.map(g => ({
      ...g,
      tasks: g.tasks.map(t =>
        t.id === taskId ? {
          ...t,
          completion: {
            ...(t.completion || { id: 0, taskId, completed: false, value: null, pointsEarned: 0, isHighlighted: false }),
            isHighlighted: !currentlyHighlighted,
          } as TaskCompletion
        } : t
      ),
    })));

    fetch('/api/tasks/highlight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, date: today, isHighlighted: !currentlyHighlighted }),
    }).then(res => {
      if (res.ok) {
        res.json().then(completion => {
          setGroups(prev => prev.map(g => ({
            ...g,
            tasks: g.tasks.map(t =>
              t.id === taskId ? { ...t, completion } : t
            ),
          })));
        });
        fetchScore();
      }
    }).catch(err => console.error("Failed to toggle highlight:", err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, groups]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      Object.values(timers).forEach(t => {
        if (t.interval) clearInterval(t.interval);
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close menu on outside click
  useEffect(() => {
    if (openMenuId === null) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuId]);

  // --- CRUD handlers ---
  const handleCopy = (task: Task) => {
    setOpenMenuId(null);
    setActionLoading(prev => ({ ...prev, [task.id]: true }));
    const freq = taskToPreset(task);
    let dbFrequency = freq.preset;
    let dbCustomDays: string | null = null;
    let dbRepeatInterval: number | null = null;

    if (freq.preset === 'weekdays') {
      dbFrequency = 'custom';
      dbCustomDays = JSON.stringify([1, 2, 3, 4, 5]);
    } else if (freq.preset === 'custom') {
      if (freq.repeatUnit === 'weeks') {
        dbFrequency = 'custom';
        dbCustomDays = JSON.stringify(freq.customDays);
        const interval = parseInt(freq.repeatInterval) || 1;
        if (interval > 1) dbRepeatInterval = interval * 7;
      } else if (freq.repeatUnit === 'months') {
        dbFrequency = 'monthly';
        dbCustomDays = JSON.stringify([freq.monthDay]);
        const interval = parseInt(freq.repeatInterval) || 1;
        if (interval > 1) dbRepeatInterval = interval;
      } else {
        dbFrequency = 'interval';
        dbRepeatInterval = parseInt(freq.repeatInterval) || 1;
      }
    } else {
      dbFrequency = freq.preset;
    }

    const body: Record<string, unknown> = {
      pillarId: task.pillarId || null,
      name: task.name + ' (copy)',
      completionType: task.completionType,
      frequency: dbFrequency,
      customDays: dbCustomDays,
      repeatInterval: dbRepeatInterval,
      basePoints: task.basePoints,
    };
    if (task.goalId) body.goalId = task.goalId;
    if (task.periodId) body.periodId = task.periodId;
    body.startDate = task.startDate || null;
    if (task.target) body.target = task.target;
    if (task.unit) body.unit = task.unit;

    fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(() => fetchTasks()).finally(() => setActionLoading(prev => ({ ...prev, [task.id]: false })));
  };

  const handleDelete = async (id: number) => {
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      await fetchTasks();
    } catch (error) {
      console.error("Failed to delete task:", error);
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleDiscard = async (task: Task) => {
    setOpenMenuId(null);
    setActionLoading(prev => ({ ...prev, [task.id]: true }));
    try {
      await fetch('/api/tasks/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id, date: today, completed: true, value: 0 }),
      });
      // Optimistic update
      setGroups(prev => prev.map(g => ({
        ...g,
        tasks: g.tasks.map(t =>
          t.id === task.id ? { ...t, completion: { ...t.completion, taskId: task.id, completed: true, value: 0, pointsEarned: 0, isHighlighted: t.completion?.isHighlighted ?? false } as TaskCompletion } : t
        ),
      })));
      await fetchScore();
    } catch (error) {
      console.error("Failed to discard task:", error);
    } finally {
      setActionLoading(prev => ({ ...prev, [task.id]: false }));
    }
  };

  const handleMoveDate = async (task: Task, direction: -1 | 1) => {
    setOpenMenuId(null);
    const currentDate = task.startDate || today;
    const d = new Date(currentDate + 'T12:00:00');
    d.setDate(d.getDate() + direction);
    const newDate = d.toISOString().split('T')[0];
    setActionLoading(prev => ({ ...prev, [task.id]: true }));
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: newDate }),
      });
      await fetchTasks();
    } catch (error) {
      console.error("Failed to move task:", error);
    } finally {
      setActionLoading(prev => ({ ...prev, [task.id]: false }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 dark:border-white"></div>
      </div>
    );
  }

  return (
    <div className="px-3 py-4 md:px-6 md:py-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header: heading, score, filters, add task */}
        <div className="mb-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white">Tasks</h1>
                {scoreSummary && (
                  <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                    {scoreSummary.actionScore}%
                    <span className="font-normal ml-1.5">{scoreSummary.completedTasks}/{scoreSummary.totalTasks}</span>
                  </span>
                )}
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                {formatDate(new Date().toISOString().split('T')[0], dateFormat)}
              </p>
            </div>
            <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 w-fit">
              {(['all', 'todo', 'done'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    statusFilter === s
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  {s === 'all' ? 'All' : s === 'todo' ? 'To Do' : 'Done'}
                </button>
              ))}
            </div>
          </div>
          {/* Progress underline */}
          <div className="mt-2 w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden relative">
            {refreshing && (
              <div className="absolute inset-0 bg-zinc-300 dark:bg-zinc-600 animate-pulse" />
            )}
            {scoreSummary && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(scoreSummary.actionScore, 100)}%` }}
                transition={{ duration: 0.5 }}
                className={`h-full rounded-full relative z-10 ${
                  scoreSummary.actionScore < 30 ? "bg-red-500" : scoreSummary.actionScore < 60 ? "bg-yellow-500" : "bg-green-500"
                }`}
              />
            )}
          </div>
        </div>

        {/* Unified accordion view */}
        {(() => {
          const allEnrichedTasks = groups.flatMap((group) =>
            group.tasks.filter((task) => {
              if (statusFilter === 'all') return true;
              const done = task.completion?.completed || (task.target != null && task.target > 0 && (task.completion?.value || 0) >= task.target);
              return statusFilter === 'done' ? done : !done;
            }).map((task) => ({ ...task, _pillarColor: group.pillar.color, _pillarEmoji: group.pillar.emoji, _pillarName: group.pillar.name }))
          ).sort((a, b) => {
              const aStarred = a.completion?.isHighlighted ? 1 : 0;
              const bStarred = b.completion?.isHighlighted ? 1 : 0;
              if (aStarred !== bStarred) return bStarred - aStarred;
              const aDone = a.completion?.completed || (a.target != null && a.target > 0 && (a.completion?.value || 0) >= a.target) ? 1 : 0;
              const bDone = b.completion?.completed || (b.target != null && b.target > 0 && (b.completion?.value || 0) >= b.target) ? 1 : 0;
              return aDone - bDone;
          });

          const starredCount = allEnrichedTasks.filter(t => t.completion?.isHighlighted).length;
          const maxStarsReached = starredCount >= 3;

          const renderTaskCard = (task: typeof allEnrichedTasks[number], showDate?: string) => {
            const isCompleted = task.completion?.completed || false;
            const currentValue = task.completion?.value || 0;
            const isDiscarded = isCompleted && task.completionType === 'checkbox' && currentValue === 0;
            const isFullyDone = !isDiscarded && (isCompleted || (task.target != null && task.target > 0 && currentValue >= task.target));
            const isHighlighted = task.completion?.isHighlighted || false;
            const isTaskLoading = actionLoading[task.id] || false;

            return (
              <div
                key={task.id}
                className={`rounded-lg px-3 py-2.5 transition-all ${
                        isDiscarded
                          ? 'bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-300 dark:border-zinc-600 opacity-60'
                          : isFullyDone
                          ? 'bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800'
                          : isHighlighted
                          ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 hover:shadow-md'
                          : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-600'
                      } ${isTaskLoading ? 'opacity-60' : ''}`}
                      style={{ borderLeftWidth: 3, borderLeftColor: isDiscarded ? '#9CA3AF' : isFullyDone ? '#4ade80' : isHighlighted ? '#F59E0B' : task._pillarColor }}
                    >
                      <div className="flex items-center gap-2">
                        {/* Left: star + name, pillar, badges */}
                        {(isHighlighted || !maxStarsReached) && (
                          <button
                            onClick={() => handleHighlightToggle(task.id)}
                            className={`shrink-0 transition-colors ${
                              isHighlighted
                                ? 'text-amber-500'
                                : 'text-zinc-300 dark:text-zinc-600 hover:text-amber-400'
                            }`}
                            title={isHighlighted ? 'Remove highlight' : 'Highlight task (max 3/day)'}
                          >
                            <FaStar className="text-xs" />
                          </button>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className={`text-sm font-semibold leading-snug ${isDiscarded ? 'line-through text-zinc-400 dark:text-zinc-500 italic' : isFullyDone ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-zinc-900 dark:text-white'}`}>
                            {task.name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0">{task._pillarEmoji} {task._pillarName}</span>
                            {task.goalId && goalsList.find(o => o.id === task.goalId) && (
                              <span className="text-[11px] px-1.5 py-px rounded-full font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 truncate max-w-[120px]">
                                {goalsList.find(o => o.id === task.goalId)?.name}
                              </span>
                            )}
                            {task.periodId && cycles.find(c => c.id === task.periodId) && (
                              <span className="text-[11px] px-1.5 py-px rounded-full font-medium bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 truncate max-w-[120px]">
                                {cycles.find(c => c.id === task.periodId)?.name}
                              </span>
                            )}
                            {showDate && (
                              <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{showDate}</span>
                            )}
                          </div>
                          {task.frequency !== 'daily' && task.frequency !== 'adhoc' && (
                            <div className="mt-0.5">
                              <span className="text-[11px] px-1.5 py-px rounded-full font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                                {task.frequency === 'monthly' ? `Monthly` :
                                 task.frequency === 'custom' ? (task.customDays ? JSON.parse(task.customDays).map((d: number) => DAYS_OF_WEEK[d]).join(', ') : 'Custom') :
                                 task.frequency === 'interval' ? `Every ${(task as unknown as Record<string, unknown>).repeatInterval || '?'} days` :
                                 task.frequency}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Right: completion controls + menu */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <>
                              {task.completionType === 'checkbox' && (
                                <button
                                  onClick={() => handleCheckboxToggle(task)}
                                  className={`w-7 h-7 rounded-md border-2 flex items-center justify-center transition-colors ${
                                    isCompleted
                                      ? 'bg-green-500 border-green-500 text-white'
                                      : 'border-zinc-300 dark:border-zinc-600 hover:border-green-500'
                                  }`}
                                >
                                  {isCompleted && <FaCheck className="text-xs" />}
                                </button>
                              )}

                              {task.completionType === 'count' && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleCountChange(task, -1)}
                                    className="w-6 h-6 rounded bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center hover:bg-zinc-300 dark:hover:bg-zinc-600"
                                  >
                                    <FaMinus className="text-[9px]" />
                                  </button>
                                  <span className={`text-xs font-bold min-w-[2.5rem] text-center ${
                                    task.target && currentValue >= task.target ? 'text-green-600 dark:text-green-400' : 'text-zinc-900 dark:text-white'
                                  }`}>
                                    {currentValue}/{task.target || '?'}
                                  </span>
                                  <button
                                    onClick={() => handleCountChange(task, 1)}
                                    className="w-6 h-6 rounded bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center hover:bg-zinc-800 dark:hover:bg-zinc-100"
                                  >
                                    <FaPlus className="text-[9px]" />
                                  </button>
                                </div>
                              )}

                              {task.completionType === 'duration' && (
                                <div className="flex items-center gap-1">
                                  {timers[task.id]?.running ? (
                                    <span className="text-xs font-mono text-zinc-700 dark:text-zinc-300 w-12 text-center">
                                      {formatTime(timers[task.id].elapsed)}
                                    </span>
                                  ) : (
                                    <>
                                      <input
                                        type="number"
                                        value={pendingValues[task.id] ?? (currentValue || '')}
                                        onChange={(e) => setPendingValues(prev => ({ ...prev, [task.id]: e.target.value }))}
                                        onKeyDown={(e) => e.key === 'Enter' && handleDurationManualSubmit(task)}
                                        placeholder="0"
                                        className="w-12 px-1.5 py-1 text-xs text-right border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                                      />
                                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400">m</span>
                                      {pendingValues[task.id] !== undefined && (
                                        <button
                                          onClick={() => handleDurationManualSubmit(task)}
                                          className="w-6 h-6 rounded bg-green-500 text-white flex items-center justify-center hover:bg-green-600"
                                        >
                                          <FaCheck className="text-[9px]" />
                                        </button>
                                      )}
                                    </>
                                  )}
                                  <button
                                    onClick={() => handleTimerToggle(task)}
                                    className={`w-6 h-6 rounded flex items-center justify-center ${
                                      timers[task.id]?.running
                                        ? 'bg-red-500 text-white'
                                        : 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                                    }`}
                                  >
                                    {timers[task.id]?.running ? <FaStop className="text-[9px]" /> : <FaPlay className="text-[9px]" />}
                                  </button>
                                </div>
                              )}

                              {task.completionType === 'numeric' && (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    value={pendingValues[task.id] ?? (currentValue || '')}
                                    onChange={(e) => setPendingValues(prev => ({ ...prev, [task.id]: e.target.value }))}
                                    onKeyDown={(e) => e.key === 'Enter' && handleNumericSubmit(task)}
                                    placeholder={task.target ? String(task.target) : '0'}
                                    className="w-14 px-1.5 py-1 text-xs text-right border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                                  />
                                  {pendingValues[task.id] !== undefined && (
                                    <button
                                      onClick={() => handleNumericSubmit(task)}
                                      className="w-6 h-6 rounded bg-green-500 text-white flex items-center justify-center hover:bg-green-600"
                                    >
                                      <FaCheck className="text-[9px]" />
                                    </button>
                                  )}
                                </div>
                              )}

                          </>

                          <div className="relative" ref={openMenuId === task.id ? menuRef : undefined}>
                            <button
                              onClick={() => setOpenMenuId(openMenuId === task.id ? null : task.id)}
                              className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700"
                            >
                              <FaEllipsisV className="text-[10px]" />
                            </button>
                            <AnimatePresence>
                              {openMenuId === task.id && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  transition={{ duration: 0.1 }}
                                  className="absolute right-0 top-7 z-20 w-36 bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden"
                                >
                                  <button
                                      onClick={() => { setOpenMenuId(null); router.push(`/tasks/${task.id}/edit`); }}
                                      className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                                    >
                                      <FaEdit className="text-xs" /> Edit
                                    </button>
                                  {task.startDate && (
                                    <>
                                      <button
                                        onClick={() => handleMoveDate(task, -1)}
                                        className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                                      >
                                        <FaArrowLeft className="text-xs" /> Move Back
                                      </button>
                                      <button
                                        onClick={() => handleMoveDate(task, 1)}
                                        className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                                      >
                                        <FaArrowRight className="text-xs" /> Move Forward
                                      </button>
                                    </>
                                  )}
                                  <button
                                    onClick={() => handleCopy(task)}
                                    className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                                  >
                                    <FaCopy className="text-xs" /> Duplicate
                                  </button>
                                  <button
                                    onClick={() => handleDiscard(task)}
                                    className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-zinc-500 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                                  >
                                    <FaTimes className="text-xs" /> Discard
                                  </button>
                                  <button
                                    onClick={() => { setOpenMenuId(null); handleDelete(task.id); }}
                                    className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  >
                                    <FaTrash className="text-xs" /> Delete
                                  </button>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
              </div>
            );
          };

          // Build accordion buckets: Today, No Date, Tomorrow, individual dates (2-6 days out), Later
          const bucketGroups: Record<string, typeof allEnrichedTasks> = {};
          for (const task of allEnrichedTasks) {
            const bucket = getDateBucket(task, today);
            if (!bucketGroups[bucket]) bucketGroups[bucket] = [];
            bucketGroups[bucket].push(task);
          }
          // Build ordered bucket list: Today, No Date, Tomorrow, then date-sorted day buckets, then Later
          const fixedOrder = ['Today', 'No Date', 'Tomorrow'];
          const dateBuckets = Object.keys(bucketGroups)
            .filter(b => !fixedOrder.includes(b) && b !== 'Later' && /^\d{4}-\d{2}-\d{2}$/.test(b))
            .sort();
          const sortedLabels = [...fixedOrder, ...dateBuckets, 'Later'].filter(b => bucketGroups[b]);

          if (allEnrichedTasks.length === 0 && !pastLoading && pastDays.length === 0) {
            return (
              <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                <p className="text-base mb-1">No tasks yet</p>
                <p className="text-sm">Click Add Task to create one</p>
              </div>
            );
          }

          // Filter past tasks by status filter too
          const filteredPastDays = pastDays.map(day => ({
            ...day,
            tasks: day.tasks.filter(t => {
              if (statusFilter === 'all') return true;
              const done = t.completed || (t.target != null && t.target > 0 && (t.value || 0) >= t.target);
              return statusFilter === 'done' ? done : !done;
            })
          })).filter(day => day.tasks.length > 0);

          // Get display label for bucket
          const getBucketLabel = (key: string): string => {
            if (key === 'Today' || key === 'Tomorrow' || key === 'No Date' || key === 'Later') return key;
            // Date bucket (YYYY-MM-DD) — show formatted date with day name
            const d = new Date(key + 'T12:00:00');
            const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
            return `${dayName}, ${formatDate(key, dateFormat)}`;
          };

          const getBucketDateRange = (label: string): string | null => {
            if (label === 'Today') return formatDate(today, dateFormat);
            if (label === 'Tomorrow') {
              const tmr = new Date(today + 'T12:00:00');
              tmr.setDate(tmr.getDate() + 1);
              return formatDate(tmr.toISOString().split('T')[0], dateFormat);
            }
            return null;
          };

          return (
            <div className="space-y-2">
              {sortedLabels.map(label => {
                const isOpen = openSchedules.has(label);
                const tasksInGroup = bucketGroups[label];
                const displayLabel = getBucketLabel(label);
                const dateRange = getBucketDateRange(label);
                const isLater = label === 'Later';
                return (
                  <div key={label} className="border border-zinc-200 dark:border-zinc-700 rounded-lg">
                    <button
                      onClick={() => setOpenSchedules(prev => {
                        const next = new Set(prev);
                        if (next.has(label)) next.delete(label); else next.add(label);
                        return next;
                      })}
                      className="w-full px-4 py-2.5 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <FaChevronDown className={`text-[10px] text-zinc-400 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{displayLabel}</span>
                        {dateRange && (
                          <span className="text-xs text-zinc-400 dark:text-zinc-500">{dateRange}</span>
                        )}
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">({tasksInGroup.length})</span>
                      </div>
                    </button>
                    {isOpen && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.5rem', padding: '0.5rem' }}>
                        {tasksInGroup.map(t => renderTaskCard(t, isLater && t.startDate ? formatDate(t.startDate, dateFormat) : undefined))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Past accordion */}
              <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg">
                <button
                  onClick={() => {
                    setOpenSchedules(prev => {
                      const next = new Set(prev);
                      if (next.has('Past')) next.delete('Past'); else next.add('Past');
                      return next;
                    });
                    if (!pastFetchedRef.current) {
                      pastFetchedRef.current = true;
                      fetchPastTasks();
                    }
                  }}
                  className="w-full px-4 py-2.5 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FaChevronDown className={`text-[10px] text-zinc-400 transition-transform ${openSchedules.has('Past') ? '' : '-rotate-90'}`} />
                    <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Past</span>
                    {pastLoading && (
                      <div className="animate-spin rounded-full h-3 w-3 border-b border-zinc-400"></div>
                    )}
                  </div>
                </button>
                {openSchedules.has('Past') && (
                  pastLoading ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-zinc-900 dark:border-white mx-auto"></div>
                    </div>
                  ) : filteredPastDays.length === 0 ? (
                    <div className="text-center py-4 text-zinc-500 dark:text-zinc-400 text-sm">
                      No past task completions
                    </div>
                  ) : (
                    <div className="p-2 space-y-2">
                      {filteredPastDays.map(day => {
                        const dateLabel = formatDate(day.date, dateFormat);
                        const completedCount = day.tasks.filter(t => t.completed || (t.target && t.target > 0 && (t.value || 0) >= t.target)).length;
                        const dayKey = `past-${day.date}`;
                        const isOpen = openSchedules.has(dayKey);
                        return (
                          <div key={day.date} className="border border-zinc-200 dark:border-zinc-700 rounded-lg">
                            <button
                              onClick={() => setOpenSchedules(prev => {
                                const next = new Set(prev);
                                if (next.has(dayKey)) next.delete(dayKey); else next.add(dayKey);
                                return next;
                              })}
                              className="w-full px-4 py-2 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <FaChevronDown className={`text-[10px] text-zinc-400 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{dateLabel}</span>
                                <span className="text-xs text-zinc-400 dark:text-zinc-500">{completedCount}/{day.tasks.length}</span>
                              </div>
                            </button>
                            {isOpen && (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.5rem', padding: '0.5rem' }}>
                                {day.tasks.map(task => {
                                  const currentValue = task.value || 0;
                                  const isDone = task.completed || (task.target != null && task.target > 0 && currentValue >= task.target);
                                  const pendingKey = `${day.date}-${task.id}`;
                                  return (
                                    <div
                                      key={pendingKey}
                                      className={`rounded-lg px-3 py-2.5 transition-all ${
                                        isDone
                                          ? 'bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800'
                                          : task.isHighlighted
                                          ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800'
                                          : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700'
                                      }`}
                                      style={{ borderLeftWidth: 3, borderLeftColor: isDone ? '#4ade80' : task.isHighlighted ? '#F59E0B' : (task.pillarColor || '#6B7280') }}
                                    >
                                      <div className="flex items-center gap-2">
                                        {task.isHighlighted && <FaStar className="text-xs text-amber-500 shrink-0" />}
                                        <div className="flex-1 min-w-0">
                                          <h3 className={`text-sm font-semibold leading-snug ${isDone ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-zinc-900 dark:text-white'}`}>
                                            {task.name}
                                          </h3>
                                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                            {task.pillarEmoji && (
                                              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{task.pillarEmoji} {task.pillarName}</span>
                                            )}
                                            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{formatDate(day.date, dateFormat)}</span>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          {task.completionType === 'checkbox' && (
                                            <button
                                              onClick={() => handlePastComplete(day.date, task.id, !isDone)}
                                              className={`w-7 h-7 rounded-md border-2 flex items-center justify-center transition-colors ${
                                                isDone
                                                  ? 'bg-green-500 border-green-500 text-white'
                                                  : 'border-zinc-300 dark:border-zinc-600 hover:border-green-500'
                                              }`}
                                            >
                                              {isDone && <FaCheck className="text-xs" />}
                                            </button>
                                          )}
                                          {task.completionType === 'count' && (
                                            <div className="flex items-center gap-1">
                                              <button
                                                onClick={() => handlePastCountChange(day.date, task, -1)}
                                                className="w-6 h-6 rounded bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center hover:bg-zinc-300 dark:hover:bg-zinc-600"
                                              >
                                                <FaMinus className="text-[9px]" />
                                              </button>
                                              <span className={`text-xs font-bold min-w-[2.5rem] text-center ${
                                                task.target && currentValue >= task.target ? 'text-green-600 dark:text-green-400' : 'text-zinc-900 dark:text-white'
                                              }`}>
                                                {currentValue}/{task.target || '?'}
                                              </span>
                                              <button
                                                onClick={() => handlePastCountChange(day.date, task, 1)}
                                                className="w-6 h-6 rounded bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center hover:bg-zinc-800 dark:hover:bg-zinc-100"
                                              >
                                                <FaPlus className="text-[9px]" />
                                              </button>
                                            </div>
                                          )}
                                          {(task.completionType === 'numeric' || task.completionType === 'duration') && (
                                            <div className="flex items-center gap-1">
                                              <input
                                                type="number"
                                                value={pastPending[pendingKey] ?? (currentValue || '')}
                                                onChange={(e) => setPastPending(prev => ({ ...prev, [pendingKey]: e.target.value }))}
                                                onKeyDown={(e) => e.key === 'Enter' && handlePastNumericSubmit(day.date, task)}
                                                placeholder={task.target ? String(task.target) : '0'}
                                                className="w-14 px-1.5 py-1 text-xs text-right border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                                              />
                                              {task.completionType === 'duration' && <span className="text-[10px] text-zinc-500 dark:text-zinc-400">m</span>}
                                              {pastPending[pendingKey] !== undefined && (
                                                <button
                                                  onClick={() => handlePastNumericSubmit(day.date, task)}
                                                  className="w-6 h-6 rounded bg-green-500 text-white flex items-center justify-center hover:bg-green-600"
                                                >
                                                  <FaCheck className="text-[9px]" />
                                                </button>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })()}

      </motion.div>

      {/* Floating Add Task button */}
      <button
        onClick={() => router.push("/tasks/new")}
        className="fixed bottom-20 md:bottom-14 right-4 md:right-8 z-40 w-12 h-12 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-lg flex items-center justify-center hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
      >
        <FaPlus className="text-lg" />
      </button>

      <Snackbar
        open={authSnackbar}
        autoHideDuration={3000}
        onClose={() => setAuthSnackbar(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <MuiAlert onClose={() => setAuthSnackbar(false)} severity="info" variant="filled" sx={{ width: "100%" }}>
          Sign in to track your tasks
        </MuiAlert>
      </Snackbar>
    </div>
  );
}
