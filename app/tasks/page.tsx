"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPlus, FaEdit, FaTrash, FaCheck, FaMinus, FaPlay, FaStop, FaEllipsisV, FaCopy, FaChevronDown, FaStar, FaTimes, FaArrowLeft, FaArrowRight } from "react-icons/fa";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Snackbar, Alert as MuiAlert } from "@mui/material";
import { DEMO_TASK_GROUPS, DEMO_PILLARS } from "@/lib/demo-data";
import { useTheme } from "@/components/ThemeProvider";
import { formatDate } from "@/lib/format";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

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
  const [filters, setFilters] = useState<{
    date: { type: 'today' | 'tomorrow' | 'week' | 'month' | 'single' | 'range' | 'no-date' | 'scheduled'; value?: string; endDate?: string };
    status: 'all' | 'todo' | 'done' | 'discarded';
    pillars: number[];
    goals: number[];
  }>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tasks-filters');
      if (saved) {
        try { return JSON.parse(saved); } catch { /* ignore */ }
      }
      const oldDate = localStorage.getItem('tasks-date-filter');
      const oldStatus = localStorage.getItem('tasks-status-filter');
      if (oldDate || oldStatus) {
        const migrated = {
          date: { type: (['today', 'tomorrow', 'week', 'month', 'no-date', 'scheduled'].includes(oldDate || '') ? oldDate : 'today') as 'today' | 'tomorrow' | 'week' | 'month' | 'single' | 'range' | 'no-date' | 'scheduled' },
          status: (['todo', 'done'].includes(oldStatus || '') ? oldStatus : 'all') as 'all' | 'todo' | 'done' | 'discarded',
          pillars: [] as number[],
          goals: [] as number[],
        };
        localStorage.removeItem('tasks-date-filter');
        localStorage.removeItem('tasks-status-filter');
        return migrated;
      }
    }
    return { date: { type: 'today' as const }, status: 'all' as const, pillars: [] as number[], goals: [] as number[] };
  });
  const [activePopover, setActivePopover] = useState<null | 'add' | 'date' | 'status' | 'pillar' | 'goal'>(null);
  const [datePickerMode, setDatePickerMode] = useState<null | 'single' | 'range'>(null);
  const [pendingRange, setPendingRange] = useState<{ from: Date; to?: Date } | undefined>(undefined);
  const [openSchedules, setOpenSchedules] = useState<Set<string>>(new Set(['Today']));
  const [scoreSummary, setScoreSummary] = useState<ScoreSummary | null>(null);
  const [timers, setTimers] = useState<Record<number, { running: boolean; elapsed: number; interval?: NodeJS.Timeout }>>({});
  const [pendingValues, setPendingValues] = useState<Record<number, string>>({});
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});
  const [authSnackbar, setAuthSnackbar] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const today = new Date().toISOString().split('T')[0];

  // Date label for chip display
  const getDateLabel = useCallback(() => {
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const todayDate = new Date(today + 'T12:00:00');
    switch (filters.date.type) {
      case 'today': return `Today (${fmt(todayDate)})`;
      case 'tomorrow': { const d = new Date(todayDate); d.setDate(d.getDate() + 1); return `Tomorrow (${fmt(d)})`; }
      case 'week': {
        const dayOfWeek = todayDate.getDay();
        const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 5 + 7 - dayOfWeek;
        const weekEnd = new Date(todayDate); weekEnd.setDate(weekEnd.getDate() + daysUntilFriday);
        return `This Week (${fmt(todayDate)} – ${fmt(weekEnd)})`;
      }
      case 'month': {
        const monthName = todayDate.toLocaleDateString('en-US', { month: 'long' });
        return `This Month (${monthName})`;
      }
      case 'single': return filters.date.value ? formatDate(filters.date.value, dateFormat) : 'Pick Date';
      case 'range': {
        if (filters.date.value && filters.date.endDate) {
          return `${fmt(new Date(filters.date.value + 'T12:00:00'))} – ${fmt(new Date(filters.date.endDate + 'T12:00:00'))}`;
        }
        return 'Date Range';
      }
      case 'no-date': return 'No Date';
      case 'scheduled': return 'Scheduled';
    }
  }, [today, filters.date, dateFormat]);

  const closePopover = useCallback(() => {
    setActivePopover(null);
    setDatePickerMode(null);
    setPendingRange(undefined);
  }, []);

  // Save filters to localStorage
  useEffect(() => {
    localStorage.setItem('tasks-filters', JSON.stringify(filters));
  }, [filters]);

  // Fetch tasks for past dates (single past date only)
  useEffect(() => {
    if (filters.date.type === 'single' && filters.date.value && filters.date.value < today) {
      fetchPastTasks(filters.date.value);
    } else {
      setPastDays([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.date.type, filters.date.value]);

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

  const fetchPastTasks = async (date?: string) => {
    setPastLoading(true);
    try {
      const url = date ? `/api/tasks/history?date=${date}` : '/api/tasks/history?limit=30';
      const res = await fetch(url);
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
        {/* Header row: title + score + filter chips inline */}
        <div className="mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white">Tasks</h1>
            {scoreSummary && filters.date.type !== 'scheduled' && (
              <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                {scoreSummary.totalTasks > 0 ? Math.round((scoreSummary.completedTasks / scoreSummary.totalTasks) * 100) : 0}%
                <span className="font-normal ml-1">{scoreSummary.completedTasks}/{scoreSummary.totalTasks}</span>
              </span>
            )}

            {/* Filter chips - inline with heading */}
            {activePopover && (
              <div className="fixed inset-0 z-40" onClick={closePopover} />
            )}
            <div className="flex flex-wrap items-center gap-1.5 ml-auto relative z-50">
              {/* Date chip */}
              <div className="relative">
                <button
                  onClick={() => { setActivePopover(activePopover === 'date' ? null : 'date'); setDatePickerMode(null); setPendingRange(undefined); }}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-500 transition-colors"
                >
                  {getDateLabel()}
                  <FaChevronDown className="text-[8px] text-zinc-400" />
                </button>
                {activePopover === 'date' && (
                  <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg p-1.5 min-w-[200px]">
                    {!datePickerMode ? (
                      <div className="space-y-0.5">
                        {(['today', 'tomorrow', 'week', 'month', 'no-date'] as const).map(type => (
                          <button
                            key={type}
                            onClick={() => { setFilters(f => ({ ...f, date: { type } })); setActivePopover(null); }}
                            className={`w-full px-3 py-1.5 text-left text-sm rounded-lg transition-colors ${
                              filters.date.type === type ? 'bg-zinc-100 dark:bg-zinc-700 font-medium text-zinc-900 dark:text-white' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50 text-zinc-600 dark:text-zinc-400'
                            }`}
                          >
                            {type === 'today' ? 'Today' : type === 'tomorrow' ? 'Tomorrow' : type === 'week' ? 'This Week' : type === 'month' ? 'This Month' : 'No Date'}
                          </button>
                        ))}
                        <div className="border-t border-zinc-100 dark:border-zinc-700 my-1" />
                        <button
                          onClick={() => { setFilters(f => ({ ...f, date: { type: 'scheduled' } })); setActivePopover(null); }}
                          className={`w-full px-3 py-1.5 text-left text-sm rounded-lg transition-colors ${
                            filters.date.type === 'scheduled' ? 'bg-zinc-100 dark:bg-zinc-700 font-medium text-zinc-900 dark:text-white' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          Scheduled
                        </button>
                        <div className="border-t border-zinc-100 dark:border-zinc-700 my-1" />
                        <button
                          onClick={() => { setDatePickerMode('single'); setPendingRange(undefined); }}
                          className={`w-full px-3 py-1.5 text-left text-sm rounded-lg transition-colors ${
                            (filters.date.type === 'single' || filters.date.type === 'range') ? 'bg-zinc-100 dark:bg-zinc-700 font-medium text-zinc-900 dark:text-white' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          Custom
                        </button>
                      </div>
                    ) : (
                      <div>
                        <button
                          onClick={() => { setDatePickerMode(null); setPendingRange(undefined); }}
                          className="px-2 py-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 mb-1"
                        >
                          &larr; Back
                        </button>
                        <p className="px-2 text-[11px] text-zinc-400 dark:text-zinc-500 mb-1">Pick a date or select a range (max 7 days)</p>
                        <style>{`
                          [data-date-picker] {
                            color: #18181b !important;
                            --rdp-accent-color: #18181b !important;
                            --rdp-accent-background-color: #fff !important;
                          }
                          [data-date-picker] .rdp-chevron { fill: currentColor !important; }
                          [data-date-picker] .rdp-day_button { color: inherit !important; border: none !important; outline: none !important; }
                          [data-date-picker] .rdp-selected { outline: none !important; border: none !important; }
                          [data-date-picker] .rdp-selected .rdp-day_button {
                            background: #fff !important; color: #18181b !important; font-weight: 600;
                            border: none !important; outline: none !important;
                          }
                          [data-date-picker] .rdp-range_start.rdp-range_end .rdp-day_button {
                            border-radius: 9999px !important;
                            border: 1.5px solid #a1a1aa !important; outline: none !important;
                          }
                          [data-date-picker] .rdp-range_start:not(.rdp-range_end) .rdp-day_button,
                          [data-date-picker] .rdp-range_end:not(.rdp-range_start) .rdp-day_button {
                            border: none !important;
                          }
                          [data-date-picker] .rdp-range_start {
                            background: #fff !important;
                            border-radius: 9999px 0 0 9999px !important;
                          }
                          [data-date-picker] .rdp-range_end {
                            background: #fff !important;
                            border-radius: 0 9999px 9999px 0 !important;
                          }
                          [data-date-picker] .rdp-range_start.rdp-range_end {
                            border-radius: 9999px !important;
                          }
                          [data-date-picker] .rdp-range_middle,
                          [data-date-picker] .rdp-selected:not(.rdp-range_start):not(.rdp-range_end):not(.rdp-range_middle) {
                            background: #fff !important;
                          }
                          [data-date-picker] .rdp-today:not(.rdp-selected) .rdp-day_button {
                            background: #dbeafe !important; border-radius: 9999px; font-weight: 600;
                          }
                          .dark [data-date-picker] .rdp-today:not(.rdp-selected) .rdp-day_button {
                            background: #1e3a5f !important; border-radius: 9999px; font-weight: 600; color: #fff !important;
                          }
                          .dark [data-date-picker] {
                            color: #e4e4e7 !important;
                            --rdp-accent-color: #fff !important;
                            --rdp-accent-background-color: #3f3f46 !important;
                          }
                          .dark [data-date-picker] .rdp-selected { outline: none !important; border: none !important; }
                          .dark [data-date-picker] .rdp-selected .rdp-day_button {
                            background: #3f3f46 !important; color: #fff !important; font-weight: 600;
                            border: none !important; outline: none !important;
                          }
                          .dark [data-date-picker] .rdp-range_start.rdp-range_end .rdp-day_button {
                            border-radius: 9999px !important;
                            border: 1.5px solid #71717a !important; outline: none !important;
                          }
                          .dark [data-date-picker] .rdp-range_start:not(.rdp-range_end) .rdp-day_button,
                          .dark [data-date-picker] .rdp-range_end:not(.rdp-range_start) .rdp-day_button {
                            border: none !important;
                          }
                          .dark [data-date-picker] .rdp-range_start {
                            background: #3f3f46 !important;
                            border-radius: 9999px 0 0 9999px !important;
                          }
                          .dark [data-date-picker] .rdp-range_end {
                            background: #3f3f46 !important;
                            border-radius: 0 9999px 9999px 0 !important;
                          }
                          .dark [data-date-picker] .rdp-range_start.rdp-range_end {
                            border-radius: 9999px !important;
                          }
                          .dark [data-date-picker] .rdp-range_middle,
                          .dark [data-date-picker] .rdp-selected:not(.rdp-range_start):not(.rdp-range_end):not(.rdp-range_middle) {
                            background: #3f3f46 !important;
                          }
                        `}</style>
                        <div data-date-picker>
                          <DayPicker
                            mode="range"
                            min={0}
                            max={7}
                            disabled={pendingRange?.from && !pendingRange?.to ? (date: Date) => {
                              const diffMs = date.getTime() - pendingRange.from.getTime();
                              const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
                              return diffDays > 7 || diffDays < -7;
                            } : undefined}
                            selected={pendingRange ?? (filters.date.type === 'range' && filters.date.value && filters.date.endDate
                              ? { from: new Date(filters.date.value + 'T12:00:00'), to: new Date(filters.date.endDate + 'T12:00:00') }
                              : filters.date.type === 'single' && filters.date.value
                              ? { from: new Date(filters.date.value + 'T12:00:00'), to: new Date(filters.date.value + 'T12:00:00') }
                              : undefined)}
                            onSelect={(range: { from?: Date; to?: Date } | undefined, triggerDate: Date) => {
                              // Click on already-pending from (no to yet, or same as from) → deselect
                              if (pendingRange?.from && triggerDate.toDateString() === pendingRange.from.toDateString() && (!pendingRange.to || pendingRange.to.toDateString() === pendingRange.from.toDateString())) {
                                setPendingRange(undefined);
                                return;
                              }
                              // Click on the end date of a pending range → deselect
                              if (pendingRange?.to && triggerDate.toDateString() === pendingRange.to.toDateString()) {
                                setPendingRange(undefined);
                                return;
                              }
                              if (range?.from) {
                                setPendingRange({ from: range.from, to: range.to });
                              } else {
                                // min=0 means first click sets both from and to to same date
                                setPendingRange(undefined);
                              }
                            }}
                          />
                        </div>
                        {pendingRange?.from && (
                          <button
                            onClick={() => {
                              const from = pendingRange.from.toISOString().split('T')[0];
                              const to = pendingRange.to ? pendingRange.to.toISOString().split('T')[0] : from;
                              if (from === to) {
                                setFilters(f => ({ ...f, date: { type: 'single', value: from } }));
                              } else {
                                setFilters(f => ({ ...f, date: { type: 'range', value: from, endDate: to } }));
                              }
                              setPendingRange(undefined);
                              closePopover();
                            }}
                            className="w-full mt-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
                          >
                            Apply{pendingRange.to && pendingRange.from.getTime() !== pendingRange.to.getTime()
                              ? ` (${Math.round((pendingRange.to.getTime() - pendingRange.from.getTime()) / 86400000) + 1} days)`
                              : ''}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Status chip */}
              {filters.status !== 'all' && (
                <div className="relative">
                  <button
                    onClick={() => setActivePopover(activePopover === 'status' ? null : 'status')}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-500 transition-colors"
                  >
                    {filters.status === 'todo' ? 'To Do' : filters.status === 'done' ? 'Done' : 'Discarded'}
                    <span
                      className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                      onClick={(e) => { e.stopPropagation(); setFilters(f => ({ ...f, status: 'all' })); }}
                    >
                      <FaTimes className="text-[8px]" />
                    </span>
                  </button>
                  {activePopover === 'status' && (
                    <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg p-1.5 min-w-[120px]">
                      {(['todo', 'done', 'discarded'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => { setFilters(f => ({ ...f, status: s })); setActivePopover(null); }}
                          className={`w-full px-3 py-1.5 text-left text-sm rounded-lg transition-colors ${
                            filters.status === s ? 'bg-zinc-100 dark:bg-zinc-700 font-medium text-zinc-900 dark:text-white' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          {s === 'todo' ? 'To Do' : s === 'done' ? 'Done' : 'Discarded'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Pillar chips */}
              {filters.pillars.map(pillarId => {
                const p = pillars.find(pl => pl.id === pillarId);
                if (!p) return null;
                return (
                  <span
                    key={`pillar-${pillarId}`}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                  >
                    {p.emoji} {p.name}
                    <FaTimes
                      className="text-[8px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                      onClick={() => setFilters(f => ({ ...f, pillars: f.pillars.filter(id => id !== pillarId), goals: f.goals.filter(gId => { const gl = goalsList.find(g => g.id === gId); return !(gl && gl.pillarId === pillarId); }) }))}
                    />
                  </span>
                );
              })}

              {/* Goal chips */}
              {filters.goals.map(goalId => {
                const g = goalsList.find(gl => gl.id === goalId);
                if (!g) return null;
                return (
                  <span
                    key={`goal-${goalId}`}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                  >
                    {g.name}
                    <FaTimes
                      className="text-[8px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                      onClick={() => setFilters(f => ({ ...f, goals: f.goals.filter(id => id !== goalId) }))}
                    />
                  </span>
                );
              })}

              {/* + Filter button */}
              <div className="relative">
                <button
                  onClick={() => setActivePopover(activePopover === 'add' ? null : 'add')}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border border-dashed border-zinc-300 dark:border-zinc-600 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors"
                >
                  <FaPlus className="text-[8px]" /> Filter
                </button>
                {activePopover === 'add' && (
                  <div className="absolute top-full right-0 mt-1 z-50 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg p-1.5 w-[180px] max-h-[360px] overflow-y-auto">
                    {/* Status section */}
                    {filters.status === 'all' && (
                      <>
                        <p className="px-3 py-1 text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Status</p>
                        {(['todo', 'done', 'discarded'] as const).map(s => (
                          <button
                            key={s}
                            onClick={() => { setFilters(f => ({ ...f, status: s })); setActivePopover(null); }}
                            className="w-full px-3 py-1.5 text-left text-sm rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700/50 text-zinc-600 dark:text-zinc-400"
                          >
                            {s === 'todo' ? 'To Do' : s === 'done' ? 'Done' : 'Discarded'}
                          </button>
                        ))}
                        <div className="border-t border-zinc-100 dark:border-zinc-700 my-1" />
                      </>
                    )}
                    {/* Pillar section */}
                    <p className="px-3 py-1 text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Pillar</p>
                    {pillars.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setFilters(f => ({
                          ...f,
                          pillars: f.pillars.includes(p.id) ? f.pillars.filter(id => id !== p.id) : [...f.pillars, p.id],
                        }))}
                        className={`w-full px-3 py-1.5 text-left text-sm rounded-lg transition-colors flex items-center gap-2 ${
                          filters.pillars.includes(p.id) ? 'bg-zinc-100 dark:bg-zinc-700 font-medium text-zinc-900 dark:text-white' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        <span>{p.emoji}</span> {p.name}
                        {filters.pillars.includes(p.id) && <FaCheck className="text-[10px] ml-auto text-green-500" />}
                      </button>
                    ))}
                    {pillars.length === 0 && <p className="px-3 py-1.5 text-sm text-zinc-400">No pillars</p>}
                    <div className="border-t border-zinc-100 dark:border-zinc-700 my-1" />
                    {/* Goal section */}
                    <p className="px-3 py-1 text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Goal</p>
                    {(filters.pillars.length > 0 ? goalsList.filter(g => g.pillarId && filters.pillars.includes(g.pillarId)) : goalsList).map(g => (
                      <button
                        key={g.id}
                        onClick={() => setFilters(f => ({
                          ...f,
                          goals: f.goals.includes(g.id) ? f.goals.filter(id => id !== g.id) : [...f.goals, g.id],
                        }))}
                        className={`w-full px-3 py-1.5 text-left text-sm rounded-lg transition-colors flex items-center gap-2 ${
                          filters.goals.includes(g.id) ? 'bg-zinc-100 dark:bg-zinc-700 font-medium text-zinc-900 dark:text-white' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        {g.name}
                        {filters.goals.includes(g.id) && <FaCheck className="text-[10px] ml-auto text-green-500" />}
                      </button>
                    ))}
                    {goalsList.length === 0 && <p className="px-3 py-1.5 text-sm text-zinc-400">No goals</p>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Progress underline */}
          {filters.date.type !== 'scheduled' && (
            <div className="mt-1.5 w-full h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden relative">
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
          )}
        </div>

        {/* Unified accordion view */}
        {(() => {
          const allEnrichedTasks = groups.flatMap((group) =>
            group.tasks.map((task) => ({ ...task, _pillarColor: group.pillar.color, _pillarEmoji: group.pillar.emoji, _pillarName: group.pillar.name }))
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

          // Filter helpers
          const getEndOfWeek = () => {
            const d = new Date(today + 'T12:00:00');
            const dayOfWeek = d.getDay();
            const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 5 + 7 - dayOfWeek;
            d.setDate(d.getDate() + daysUntilFriday);
            return d.toISOString().split('T')[0];
          };

          const getTomorrow = () => {
            const d = new Date(today + 'T12:00:00');
            d.setDate(d.getDate() + 1);
            return d.toISOString().split('T')[0];
          };

          const getTaskDate = (bucket: string): string | null => {
            if (bucket === 'Today') return today;
            if (bucket === 'Tomorrow') return getTomorrow();
            if (bucket === 'No Date' || bucket === 'Later') return null;
            return bucket; // YYYY-MM-DD
          };

          const getEndOfMonth = () => {
            const d = new Date(today + 'T12:00:00');
            const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
            return lastDay.toISOString().split('T')[0];
          };

          const isTaskInDateRange = (task: typeof allEnrichedTasks[number]): boolean => {
            const bucket = getDateBucket(task, today);
            switch (filters.date.type) {
              case 'today':
                return bucket === 'Today';
              case 'tomorrow':
                return bucket === 'Tomorrow';
              case 'week': {
                if (bucket === 'No Date' || bucket === 'Later') return false;
                if (bucket === 'Today' || bucket === 'Tomorrow') return true;
                return bucket >= today && bucket <= getEndOfWeek();
              }
              case 'month': {
                if (bucket === 'Today' || bucket === 'Tomorrow') return true;
                if (bucket === 'No Date') return false;
                const monthEnd = getEndOfMonth();
                if (bucket === 'Later') {
                  // For adhoc tasks, check startDate
                  if (task.frequency === 'adhoc') {
                    return task.startDate ? task.startDate >= today && task.startDate <= monthEnd : false;
                  }
                  // For recurring tasks, check if any occurrence falls within the remaining month
                  const d = new Date(today + 'T12:00:00');
                  d.setDate(d.getDate() + 7); // "Later" starts after 6 days
                  while (d.toISOString().split('T')[0] <= monthEnd) {
                    const dStr = d.toISOString().split('T')[0];
                    const dow = d.getDay();
                    let matches = false;
                    if (task.frequency === 'daily') matches = true;
                    else if (task.frequency === 'custom' && task.customDays) {
                      try { matches = JSON.parse(task.customDays).includes(dow); } catch { /* ignore */ }
                    } else if (task.frequency === 'monthly' && task.customDays) {
                      try { matches = JSON.parse(task.customDays).includes(d.getDate()); } catch { /* ignore */ }
                    } else if (task.frequency === 'weekly') {
                      matches = dow === 1;
                    }
                    if (matches && (!task.startDate || dStr >= task.startDate)) return true;
                    d.setDate(d.getDate() + 1);
                  }
                  return false;
                }
                return bucket >= today && bucket <= monthEnd;
              }
              case 'single': {
                if (!filters.date.value) return false;
                if (filters.date.value >= today) {
                  if (filters.date.value === today) return bucket === 'Today';
                  if (filters.date.value === getTomorrow()) return bucket === 'Tomorrow';
                  if (bucket === 'No Date') return false;
                  if (bucket === 'Later') return task.startDate === filters.date.value;
                  return bucket === filters.date.value;
                }
                return false;
              }
              case 'range': {
                if (!filters.date.value || !filters.date.endDate) return false;
                const taskDate = getTaskDate(bucket);
                if (!taskDate && bucket === 'Later') {
                  return task.startDate ? task.startDate >= filters.date.value && task.startDate <= filters.date.endDate : false;
                }
                if (!taskDate) return false;
                return taskDate >= filters.date.value && taskDate <= filters.date.endDate;
              }
              case 'no-date':
                return bucket === 'No Date';
              default:
                return true;
            }
          };

          const passesStatusFilter = (completed: boolean, value: number | null) => {
            if (filters.status === 'all') return true;
            const val = value || 0;
            const isDiscarded = completed && val === 0;
            const isDone = !isDiscarded && completed;
            if (filters.status === 'discarded') return isDiscarded;
            if (filters.status === 'done') return isDone;
            if (filters.status === 'todo') return !completed;
            return true;
          };

          const isScheduledView = filters.date.type === 'scheduled';
          const isPastDateView = !isScheduledView && filters.date.type === 'single' && filters.date.value && filters.date.value < today;
          const filteredTasks = (isPastDateView || isScheduledView) ? [] : allEnrichedTasks.filter(task => {
            if (!isTaskInDateRange(task)) return false;
            const completed = task.completion?.completed || (task.target != null && task.target > 0 && (task.completion?.value || 0) >= task.target);
            if (!passesStatusFilter(completed, task.completion?.value ?? null)) return false;
            if (filters.pillars.length > 0 && !filters.pillars.includes(task.pillarId)) return false;
            if (filters.goals.length > 0 && !(task.goalId && filters.goals.includes(task.goalId))) return false;
            return true;
          });

          // For scheduled view: show only recurring task definitions (not adhoc instances)
          const scheduledTasks = isScheduledView ? allEnrichedTasks.filter(task => {
            if (task.frequency === 'adhoc') return false;
            if (filters.pillars.length > 0 && !filters.pillars.includes(task.pillarId)) return false;
            if (filters.goals.length > 0 && !(task.goalId && filters.goals.includes(task.goalId))) return false;
            return true;
          }) : [];

          // Filter past tasks too
          const filteredPastDays = pastDays.map(day => ({
            ...day,
            tasks: day.tasks.filter(t => {
              const completed = t.completed || (t.target != null && t.target > 0 && (t.value || 0) >= t.target);
              if (!passesStatusFilter(completed, t.value)) return false;
              if (filters.pillars.length > 0) {
                const pillar = pillars.find(p => p.name === t.pillarName);
                if (pillar && !filters.pillars.includes(pillar.id)) return false;
              }
              if (filters.goals.length > 0 && !(t.goalId && filters.goals.includes(t.goalId))) return false;
              return true;
            })
          })).filter(day => day.tasks.length > 0);

          if (allEnrichedTasks.length === 0 && !pastLoading && pastDays.length === 0) {
            return (
              <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                <p className="text-base mb-1">No tasks yet</p>
                <p className="text-sm">Click Add Task to create one</p>
              </div>
            );
          }

          const getScheduleLabel = (task: typeof allEnrichedTasks[number]) => {
            if (task.frequency === 'daily') return 'Every day';
            if (task.frequency === 'weekly') return 'Every Monday';
            if (task.frequency === 'custom' && task.customDays) {
              try {
                const days: number[] = JSON.parse(task.customDays);
                const dayLabels = days.map((d: number) => DAYS_OF_WEEK[d]).join(', ');
                const interval = task.repeatInterval && task.repeatInterval > 7 ? Math.round(task.repeatInterval / 7) : 1;
                return interval > 1 ? `${dayLabels} (every ${interval} weeks)` : dayLabels;
              } catch { return 'Custom'; }
            }
            if (task.frequency === 'monthly' && task.customDays) {
              try {
                const days: number[] = JSON.parse(task.customDays);
                const interval = task.repeatInterval && task.repeatInterval > 1 ? task.repeatInterval : 1;
                const dayStr = days.map(d => `${d}${d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'}`).join(', ');
                return interval > 1 ? `${dayStr} of every ${interval} months` : `${dayStr} of every month`;
              } catch { return 'Monthly'; }
            }
            if (task.frequency === 'interval') return `Every ${task.repeatInterval || '?'} days`;
            return task.frequency;
          };

          const getCompletionTypeLabel = (type: string) => {
            switch (type) {
              case 'checkbox': return 'Checkbox';
              case 'count': return 'Counter';
              case 'numeric': return 'Numeric';
              case 'duration': return 'Timer';
              default: return type;
            }
          };

          return (
            <div>
              {isScheduledView ? (
                scheduledTasks.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                    <p className="text-sm">No scheduled (recurring) tasks</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.5rem' }}>
                    {scheduledTasks.map(task => (
                      <div
                        key={task.id}
                        className="rounded-lg px-3 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-600 transition-all"
                        style={{ borderLeftWidth: 3, borderLeftColor: task._pillarColor }}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold leading-snug text-zinc-900 dark:text-white">
                              {task.name}
                            </h3>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0">{task._pillarEmoji} {task._pillarName}</span>
                              {task.goalId && goalsList.find(o => o.id === task.goalId) && (
                                <span className="text-[11px] px-1.5 py-px rounded-full font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 truncate max-w-[120px]">
                                  {goalsList.find(o => o.id === task.goalId)?.name}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                                {getScheduleLabel(task)}
                              </span>
                              <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                                {getCompletionTypeLabel(task.completionType)}
                              </span>
                              {task.target && (
                                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                  Target: {task.target}{task.unit ? ` ${task.unit}` : ''}
                                </span>
                              )}
                              <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                                {task.basePoints}pts
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => router.push(`/tasks/${task.id}/edit`)}
                              className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700"
                              title="Edit"
                            >
                              <FaEdit className="text-xs" />
                            </button>
                            <button
                              onClick={() => handleDelete(task.id)}
                              className="p-1.5 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Delete"
                            >
                              <FaTrash className="text-xs" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : !isPastDateView ? (
                filteredTasks.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                    <p className="text-sm">No tasks for this period</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.5rem' }}>
                    {filteredTasks.map(t => {
                      const bucket = getDateBucket(t, today);
                      const showDate = (filters.date.type !== 'today' && bucket !== 'Today') ? (
                        bucket === 'Tomorrow' ? 'Tomorrow' :
                        bucket === 'No Date' ? undefined :
                        t.startDate ? formatDate(t.startDate, dateFormat) : undefined
                      ) : undefined;
                      return renderTaskCard(t, showDate);
                    })}
                  </div>
                )
              ) : (
                // Past date view
                pastLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-zinc-900 dark:border-white mx-auto"></div>
                  </div>
                ) : filteredPastDays.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 dark:text-zinc-400 text-sm">
                    No tasks for this date
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredPastDays.map(day => {
                      const dateLabel = formatDate(day.date, dateFormat);
                      const completedCount = day.tasks.filter(t => t.completed || (t.target && t.target > 0 && (t.value || 0) >= t.target)).length;
                      const dayKey = `past-${day.date}`;
                      const isOpen = openSchedules.has(dayKey);
                      return (
                        <div key={day.date}>
                          <button
                            onClick={() => setOpenSchedules(prev => {
                              const next = new Set(prev);
                              if (next.has(dayKey)) next.delete(dayKey); else next.add(dayKey);
                              return next;
                            })}
                            className="w-full px-3 py-2 flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                          >
                            <FaChevronDown className={`text-[10px] text-zinc-400 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                            <span>{dateLabel}</span>
                            <span className="text-xs text-zinc-400 dark:text-zinc-500">{completedCount}/{day.tasks.length}</span>
                          </button>
                          {isOpen && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.5rem' }}>
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
