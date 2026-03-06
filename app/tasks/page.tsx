"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPlus, FaEdit, FaTrash, FaTimes, FaCheck, FaMinus, FaPlay, FaStop, FaEllipsisV, FaCopy, FaChevronRight, FaChevronDown, FaArrowRight, FaCalendarAlt, FaStar } from "react-icons/fa";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

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
  flexibilityRule: string;
  windowStart: number | null;
  windowEnd: number | null;
  limitValue: number | null;
  frequency: string;
  customDays: string | null;
  toleranceBefore: number | null;
  toleranceAfter: number | null;
  isWeekendTask: boolean;
  basePoints: number;
  outcomeId: number | null;
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

const COMPLETION_TYPES = [
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'count', label: 'Count' },
  { value: 'duration', label: 'Duration (min)' },
  { value: 'numeric', label: 'Numeric' },
];

const FREQUENCY_PRESETS = [
  { value: 'adhoc', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Every weekday (Mon–Fri)' },
  { value: 'custom', label: 'Custom...' },
];

const REPEAT_UNITS = [
  { value: 'days', label: 'day' },
  { value: 'weeks', label: 'week' },
  { value: 'months', label: 'month' },
];

const FLEXIBILITY_OPTIONS = [
  { value: 'must_today', label: 'Standard', desc: 'Simple completion' },
  { value: 'at_least', label: 'At Least', desc: 'Achieve a minimum target' },
  { value: 'limit_avoid', label: 'Limit', desc: 'Stay under a maximum' },
];

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDateBucket(task: { frequency: string; customDays?: string | null; createdAt?: unknown; repeatInterval?: number | null; toleranceBefore?: number | null; toleranceAfter?: number | null; startDate?: string | null }, todayStr: string): string {
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
      const created = task.createdAt ? new Date(task.createdAt as string | number | Date).toISOString().split('T')[0] : null;
      matches = created === dStr;
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

    // Rest of this week (up to Sunday)
    const daysUntilSunday = (7 - todayDay) % 7;
    if (i <= daysUntilSunday) return 'Rest of the Week';

    // Next week
    if (i <= daysUntilSunday + 7) return 'Next Week';

    // Rest of this month
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const daysUntilEndOfMonth = Math.round((endOfMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (i <= daysUntilEndOfMonth) return 'Rest of the Month';

    // Next month
    const endOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    const daysUntilEndOfNextMonth = Math.round((endOfNextMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (i <= daysUntilEndOfNextMonth) return 'Next Month';

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
  const router = useRouter();
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<'today' | 'all'>('today');
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'done'>('all');
  const [openSchedules, setOpenSchedules] = useState<Set<string>>(new Set(['Today', 'Tomorrow', 'Rest of the Week']));
  const [scoreSummary, setScoreSummary] = useState<ScoreSummary | null>(null);
  const [timers, setTimers] = useState<Record<number, { running: boolean; elapsed: number; interval?: NodeJS.Timeout }>>({});
  const [pendingValues, setPendingValues] = useState<Record<number, string>>({});
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [quickAdd, setQuickAdd] = useState({ name: '', date: new Date().toISOString().split('T')[0] });
  const menuRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    pillarId: 0,
    name: '',
    completionType: 'checkbox',
    target: '',
    unit: '',

    frequencyPreset: 'adhoc' as string,
    frequency: 'adhoc',
    customDays: [] as number[],
    repeatInterval: '1',
    repeatUnit: 'days' as 'days' | 'weeks' | 'months',
    monthDay: 1,
    basePoints: '10',
    flexibilityRule: 'must_today',
    toleranceBefore: '0',
    toleranceAfter: '0',
    limitValue: '',
    outcomeId: 0,
    periodId: 0,
    startDate: '',
  });

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (session?.user?.id) {
      fetchPillars();
      fetchOutcomes();
      fetchCycles();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchTasks();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, filter]);

  const fetchPillars = async () => {
    try {
      const res = await fetch('/api/pillars');
      if (res.ok) {
        const p = await res.json();
        setPillars(p);
        if (p.length > 0 && form.pillarId === 0) {
          setForm(prev => ({ ...prev, pillarId: p[0].id }));
        }
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
        setOutcomes(data.map((o: Outcome & { pillarId: number | null; goalType: string }) => ({ id: o.id, pillarId: o.pillarId, name: o.name, goalType: o.goalType || 'outcome' })));
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
      const url = filter === 'today' ? `/api/tasks?date=${today}` : `/api/tasks?date=${today}&all=true`;
      const res = await fetch(url);
      if (res.ok) {
        setGroups(await res.json());
      }
      await fetchScore();
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    } finally {
      setLoading(false);
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
      }
    } catch (error) {
      console.error("Failed to fetch score:", error);
    }
  };

  // --- Completion handlers ---
  const handleComplete = useCallback((taskId: number, completed?: boolean, value?: number) => {
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
    setEditingTask(null);
    const freq = taskToPreset(task);
    setForm({
      pillarId: task.pillarId,
      name: task.name + ' (copy)',
      completionType: task.completionType,
      target: task.target?.toString() || '',
      unit: task.unit || '',
      frequencyPreset: freq.preset,
      frequency: task.frequency,
      customDays: freq.customDays,
      repeatInterval: freq.repeatInterval,
      repeatUnit: freq.repeatUnit,
      monthDay: freq.monthDay,
      basePoints: task.basePoints.toString(),
      flexibilityRule: task.flexibilityRule,
      toleranceBefore: task.toleranceBefore?.toString() || '0',
      toleranceAfter: task.toleranceAfter?.toString() || '0',
      limitValue: task.limitValue?.toString() || '',
      outcomeId: task.outcomeId || 0,
      periodId: task.periodId || 0,
      startDate: task.startDate || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;

    // Convert form preset to DB frequency + fields
    let dbFrequency = form.frequency;
    let dbCustomDays: string | null = null;
    let dbRepeatInterval: number | null = null;

    if (form.frequencyPreset === 'weekdays') {
      dbFrequency = 'custom';
      dbCustomDays = JSON.stringify([1, 2, 3, 4, 5]);
    } else if (form.frequencyPreset === 'custom') {
      if (form.repeatUnit === 'weeks') {
        dbFrequency = 'custom';
        dbCustomDays = JSON.stringify(form.customDays);
        const interval = parseInt(form.repeatInterval) || 1;
        if (interval > 1) dbRepeatInterval = interval * 7;
      } else if (form.repeatUnit === 'months') {
        dbFrequency = 'monthly';
        dbCustomDays = JSON.stringify([form.monthDay]);
        const interval = parseInt(form.repeatInterval) || 1;
        if (interval > 1) dbRepeatInterval = interval;
      } else {
        // days
        dbFrequency = 'interval';
        dbRepeatInterval = parseInt(form.repeatInterval) || 1;
      }
    } else {
      dbFrequency = form.frequencyPreset; // daily, adhoc
    }

    const body: Record<string, unknown> = {
      pillarId: form.pillarId || null,
      name: form.name,
      completionType: form.completionType,
      frequency: dbFrequency,
      customDays: dbCustomDays,
      repeatInterval: dbRepeatInterval,
      basePoints: parseFloat(form.basePoints) || 10,
      flexibilityRule: form.flexibilityRule,
    };

    if (form.outcomeId) body.outcomeId = form.outcomeId;
    if (form.periodId) body.periodId = form.periodId;
    body.startDate = form.startDate || null;
    if (form.target) body.target = parseFloat(form.target);
    if (form.unit) body.unit = form.unit;
    if (form.toleranceBefore) body.toleranceBefore = parseInt(form.toleranceBefore);
    if (form.toleranceAfter) body.toleranceAfter = parseInt(form.toleranceAfter);
    if (form.flexibilityRule === 'limit_avoid' && dbFrequency !== 'adhoc') {
      if (form.limitValue) body.limitValue = parseFloat(form.limitValue);
    }

    try {
      if (editingTask) {
        await fetch(`/api/tasks/${editingTask.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      await fetchTasks();
      resetForm();
    } catch (error) {
      console.error("Failed to save task:", error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      await fetchTasks();
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingTask(null);
    setForm({
      pillarId: pillars[0]?.id || 0,
      name: '',
      completionType: 'checkbox',
      target: '',
      unit: '',
      frequencyPreset: 'daily',
      frequency: 'daily',
      customDays: [],
      repeatInterval: '1',
      repeatUnit: 'days' as 'days' | 'weeks' | 'months',
      monthDay: 1,
      basePoints: '10',
      flexibilityRule: 'must_today',
      toleranceBefore: '0',
      toleranceAfter: '0',
      limitValue: '',
      outcomeId: 0,
      periodId: 0,
      startDate: '',
    });
  };

  const startEdit = (task: Task) => {
    const freq = taskToPreset(task);
    setEditingTask(task);
    setForm({
      pillarId: task.pillarId,
      name: task.name,
      completionType: task.completionType,
      target: task.target?.toString() || '',
      unit: task.unit || '',
      frequencyPreset: freq.preset,
      frequency: task.frequency,
      customDays: freq.customDays,
      repeatInterval: freq.repeatInterval,
      repeatUnit: freq.repeatUnit,
      monthDay: freq.monthDay,
      basePoints: task.basePoints.toString(),
      flexibilityRule: task.flexibilityRule,
      toleranceBefore: task.toleranceBefore?.toString() || '0',
      toleranceAfter: task.toleranceAfter?.toString() || '0',
      limitValue: task.limitValue?.toString() || '',
      outcomeId: task.outcomeId || 0,
      periodId: task.periodId || 0,
      startDate: task.startDate || '',
    });
    setShowForm(true);
  };

  const toggleCustomDay = (day: number) => {
    setForm(prev => ({
      ...prev,
      customDays: prev.customDays.includes(day)
        ? prev.customDays.filter(d => d !== day)
        : [...prev.customDays, day],
    }));
  };

  const handleQuickAdd = async () => {
    if (!quickAdd.name.trim()) return;
    const body: Record<string, unknown> = {
      name: quickAdd.name,
      frequency: 'adhoc',
      completionType: 'checkbox',
      basePoints: 10,
    };
    if (quickAdd.date) body.startDate = quickAdd.date;
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setQuickAdd({ name: '', date: '' });
      await fetchTasks();
    } catch (error) {
      console.error("Failed to quick-add task:", error);
    }
  };

  const handleQuickAddExpand = () => {
    setEditingTask(null);
    setForm({
      pillarId: pillars[0]?.id || 0,
      name: quickAdd.name,
      completionType: 'checkbox',
      target: '',
      unit: '',
      frequencyPreset: 'adhoc',
      frequency: 'adhoc',
      customDays: [],
      repeatInterval: '1',
      repeatUnit: 'days' as 'days' | 'weeks' | 'months',
      monthDay: 1,
      basePoints: '10',
      flexibilityRule: 'must_today',
      toleranceBefore: '0',
      toleranceAfter: '0',
      limitValue: '',
      outcomeId: 0,
      periodId: 0,
      startDate: '',
    });
    setShowForm(true);
    setQuickAdd({ name: '', date: '' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isToday = filter === 'today';

  return (
    <div className="px-3 py-4 md:px-6 md:py-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Tasks</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              {!isToday && ' · Showing all tasks'}
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { resetForm(); setShowForm(true); }}
            className="px-4 py-2 text-sm bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium flex items-center gap-2 shadow-sm"
          >
            <FaPlus className="text-xs" /> Add Task
          </motion.button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
            <button
              onClick={() => setFilter('today')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                filter === 'today'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                filter === 'all'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              All
            </button>
          </div>
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
            {(['all', 'todo', 'done'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  statusFilter === s
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {s === 'all' ? 'All' : s === 'todo' ? 'To Do' : 'Done'}
              </button>
            ))}
          </div>
        </div>

        {/* Quick-Add Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 mb-4">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={quickAdd.name}
                onChange={(e) => setQuickAdd({ ...quickAdd, name: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
                placeholder="Quick add a task..."
                className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
              <div className="relative shrink-0">
                <input
                  type="date"
                  value={quickAdd.date}
                  onChange={(e) => setQuickAdd({ ...quickAdd, date: e.target.value })}
                  className="hidden md:block px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-[130px]"
                />
                <label className="md:hidden p-2 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 cursor-pointer flex items-center">
                  <FaCalendarAlt className="text-sm" />
                  <input
                    type="date"
                    value={quickAdd.date}
                    onChange={(e) => setQuickAdd({ ...quickAdd, date: e.target.value })}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  />
                </label>
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleQuickAddExpand}
                className="p-2 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors shrink-0"
                title="Expand to full form"
              >
                <FaChevronRight className="text-sm" />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleQuickAdd}
                disabled={!quickAdd.name.trim()}
                className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg shrink-0"
              >
                <FaArrowRight className="text-sm" />
              </motion.button>
            </div>
          </div>

        {/* Score Summary Bar */}
        {scoreSummary && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {scoreSummary.actionScore}%
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {scoreSummary.scoreTier}
                </span>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {scoreSummary.completedTasks}/{scoreSummary.totalTasks} tasks
              </span>
            </div>
            <div className="mt-2 w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(scoreSummary.actionScore, 100)}%` }}
                transition={{ duration: 0.5 }}
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
              />
            </div>
          </div>
        )}

        {/* Task Groups */}
        {groups.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p className="text-base mb-1">No tasks {isToday ? 'for today' : 'yet'}</p>
            <p className="text-sm">Click Add Task to create one</p>
          </div>
        )}

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

          const renderTaskCard = (task: typeof allEnrichedTasks[number]) => {
            const isCompleted = task.completion?.completed || false;
            const currentValue = task.completion?.value || 0;
            const isFullyDone = isCompleted || (task.target != null && task.target > 0 && currentValue >= task.target);
            const isHighlighted = task.completion?.isHighlighted || false;

            return (
              <div
                key={task.id}
                className={`rounded-lg px-3 py-2.5 transition-all ${
                        isFullyDone
                          ? 'bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800'
                          : isHighlighted
                          ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 hover:shadow-md'
                          : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                      style={{ borderLeftWidth: 3, borderLeftColor: isFullyDone ? '#4ade80' : isHighlighted ? '#F59E0B' : task._pillarColor }}
                    >
                      <div className="flex items-center gap-2">
                        {/* Left: star + name, pillar, badges */}
                        {(isHighlighted || !maxStarsReached) && (
                          <button
                            onClick={() => handleHighlightToggle(task.id)}
                            className={`shrink-0 transition-colors ${
                              isHighlighted
                                ? 'text-amber-500'
                                : 'text-gray-300 dark:text-gray-600 hover:text-amber-400'
                            }`}
                            title={isHighlighted ? 'Remove highlight' : 'Highlight task (max 3/day)'}
                          >
                            <FaStar className="text-xs" />
                          </button>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className={`text-sm font-semibold leading-snug ${isFullyDone ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                            {task.name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] text-gray-500 dark:text-gray-400 shrink-0">{task._pillarEmoji} {task._pillarName}</span>
                            {task.outcomeId && outcomes.find(o => o.id === task.outcomeId) && (
                              <span className="text-[11px] px-1.5 py-px rounded-full font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 truncate max-w-[120px]">
                                {outcomes.find(o => o.id === task.outcomeId)?.name}
                              </span>
                            )}
                            {task.periodId && cycles.find(c => c.id === task.periodId) && (
                              <span className="text-[11px] px-1.5 py-px rounded-full font-medium bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 truncate max-w-[120px]">
                                {cycles.find(c => c.id === task.periodId)?.name}
                              </span>
                            )}
                          </div>
                          {task.frequency !== 'daily' && (
                            <div className="mt-0.5">
                              <span className="text-[11px] px-1.5 py-px rounded-full font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                                {task.frequency === 'adhoc' ? 'One-time' :
                                 task.frequency === 'monthly' ? `Monthly` :
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
                                <motion.button
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleCheckboxToggle(task)}
                                  className={`w-7 h-7 rounded-md border-2 flex items-center justify-center transition-colors ${
                                    isCompleted
                                      ? 'bg-green-500 border-green-500 text-white'
                                      : 'border-gray-300 dark:border-gray-600 hover:border-green-500'
                                  }`}
                                >
                                  {isCompleted && <FaCheck className="text-xs" />}
                                </motion.button>
                              )}

                              {task.completionType === 'count' && (
                                <div className="flex items-center gap-1">
                                  <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleCountChange(task, -1)}
                                    className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600"
                                  >
                                    <FaMinus className="text-[9px]" />
                                  </motion.button>
                                  <span className={`text-xs font-bold min-w-[2.5rem] text-center ${
                                    task.target && currentValue >= task.target ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'
                                  }`}>
                                    {currentValue}/{task.target || '?'}
                                  </span>
                                  <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleCountChange(task, 1)}
                                    className="w-6 h-6 rounded bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600"
                                  >
                                    <FaPlus className="text-[9px]" />
                                  </motion.button>
                                </div>
                              )}

                              {task.completionType === 'duration' && (
                                <div className="flex items-center gap-1">
                                  {timers[task.id]?.running ? (
                                    <span className="text-xs font-mono text-gray-700 dark:text-gray-300 w-12 text-center">
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
                                        className="w-12 px-1.5 py-1 text-xs text-right border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                      />
                                      <span className="text-[10px] text-gray-500 dark:text-gray-400">m</span>
                                      {pendingValues[task.id] !== undefined && (
                                        <motion.button
                                          whileTap={{ scale: 0.9 }}
                                          onClick={() => handleDurationManualSubmit(task)}
                                          className="w-6 h-6 rounded bg-green-500 text-white flex items-center justify-center hover:bg-green-600"
                                        >
                                          <FaCheck className="text-[9px]" />
                                        </motion.button>
                                      )}
                                    </>
                                  )}
                                  <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleTimerToggle(task)}
                                    className={`w-6 h-6 rounded flex items-center justify-center ${
                                      timers[task.id]?.running
                                        ? 'bg-red-500 text-white'
                                        : 'bg-blue-500 text-white'
                                    }`}
                                  >
                                    {timers[task.id]?.running ? <FaStop className="text-[9px]" /> : <FaPlay className="text-[9px]" />}
                                  </motion.button>
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
                                    className="w-14 px-1.5 py-1 text-xs text-right border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                  />
                                  {pendingValues[task.id] !== undefined && (
                                    <motion.button
                                      whileTap={{ scale: 0.9 }}
                                      onClick={() => handleNumericSubmit(task)}
                                      className="w-6 h-6 rounded bg-green-500 text-white flex items-center justify-center hover:bg-green-600"
                                    >
                                      <FaCheck className="text-[9px]" />
                                    </motion.button>
                                  )}
                                </div>
                              )}

                          </>

                          <div className="relative" ref={openMenuId === task.id ? menuRef : undefined}>
                            <button
                              onClick={() => setOpenMenuId(openMenuId === task.id ? null : task.id)}
                              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
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
                                  className="absolute right-0 top-7 z-20 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                                >
                                  {task.outcomeId ? (
                                    <button
                                      onClick={() => { setOpenMenuId(null); router.push('/outcomes'); }}
                                      className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
                                      <FaArrowRight className="text-xs" /> Edit in Goals
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => { setOpenMenuId(null); startEdit(task); }}
                                      className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
                                      <FaEdit className="text-xs" /> Edit
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleCopy(task)}
                                    className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    <FaCopy className="text-xs" /> Duplicate
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

          if (!isToday && allEnrichedTasks.length > 0) {
            // "All" view: group by date bucket in accordions
            const bucketOrder = ['Today', 'Tomorrow', 'Rest of the Week', 'Next Week', 'Rest of the Month', 'Next Month', 'Later', 'No Date'];
            const bucketGroups: Record<string, typeof allEnrichedTasks> = {};
            for (const task of allEnrichedTasks) {
              const bucket = getDateBucket(task, today);
              if (!bucketGroups[bucket]) bucketGroups[bucket] = [];
              bucketGroups[bucket].push(task);
            }
            const sortedLabels = bucketOrder.filter(b => bucketGroups[b]);

            return (
              <div className="space-y-2">
                {sortedLabels.map(label => {
                  const isOpen = openSchedules.has(label);
                  const tasksInGroup = bucketGroups[label];
                  return (
                    <div key={label} className="border border-gray-200 dark:border-gray-700 rounded-lg">
                      <button
                        onClick={() => setOpenSchedules(prev => {
                          const next = new Set(prev);
                          if (next.has(label)) next.delete(label); else next.add(label);
                          return next;
                        })}
                        className="w-full px-4 py-2.5 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <FaChevronDown className={`text-[10px] text-gray-400 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">({tasksInGroup.length})</span>
                        </div>
                      </button>
                      {isOpen && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.5rem', padding: '0.5rem' }}>
                          {tasksInGroup.map(renderTaskCard)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          }

          // "Today" view: flat grid
          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {allEnrichedTasks.map(renderTaskCard)}
            </div>
          );
        })()}

        {/* Add/Edit Form Modal */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={resetForm}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {editingTask ? 'Edit Task' : 'New Task'}
                  </h2>
                  <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <FaTimes />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Task Name</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="e.g., Gym session"
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pillar</label>
                      <select
                        value={form.pillarId}
                        onChange={e => setForm({ ...form, pillarId: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value={0}>📋 None</option>
                        {pillars.map(p => (
                          <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Points</label>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setForm({ ...form, basePoints: Math.max(0, (parseFloat(form.basePoints) || 0) - 5).toString() })}
                          className="w-8 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                        >
                          <FaMinus className="text-[10px]" />
                        </button>
                        <input
                          type="number"
                          value={form.basePoints}
                          onChange={e => setForm({ ...form, basePoints: e.target.value })}
                          className="flex-1 px-2 py-2 text-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          min="0"
                        />
                        <button
                          onClick={() => setForm({ ...form, basePoints: ((parseFloat(form.basePoints) || 0) + 5).toString() })}
                          className="w-8 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                        >
                          <FaPlus className="text-[10px]" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Linked Outcome */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Linked Goal (optional)</label>
                    <select
                      value={form.outcomeId}
                      onChange={e => setForm({ ...form, outcomeId: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value={0}>None</option>
                      {outcomes
                        .filter(o => !form.pillarId || o.pillarId === form.pillarId || !o.pillarId)
                        .map(o => (
                          <option key={o.id} value={o.id}>{o.goalType === 'effort' ? '⚡ ' : '📈 '}{o.name}</option>
                        ))}
                    </select>
                  </div>

                  {/* Linked Cycle */}
                  {cycles.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Linked Cycle (optional)</label>
                      <select
                        value={form.periodId}
                        onChange={e => setForm({ ...form, periodId: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value={0}>None</option>
                        {cycles.map(c => (
                          <option key={c.id} value={c.id}>{c.name}{c.isActive ? ' (Active)' : ''}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Start Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date (optional)</label>
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <p className="text-xs text-gray-400 mt-0.5">Task will only appear from this date onwards</p>
                  </div>

                  {/* Completion Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Completion Type</label>
                    <div className="grid grid-cols-4 gap-2">
                      {COMPLETION_TYPES.map(ct => (
                        <button
                          key={ct.value}
                          onClick={() => setForm({ ...form, completionType: ct.value })}
                          className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                            form.completionType === ct.value
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                              : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {ct.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Target & Unit (for non-checkbox types) */}
                  {form.completionType !== 'checkbox' && (
                    <div className={`grid gap-3 ${form.completionType === 'duration' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {form.completionType === 'duration' ? 'Target (minutes)' : 'Target'}
                        </label>
                        <input
                          type="number"
                          value={form.target}
                          onChange={e => setForm({ ...form, target: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder={form.completionType === 'duration' ? 'e.g., 30' : 'e.g., 8'}
                        />
                      </div>
                      {form.completionType !== 'duration' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit</label>
                          <input
                            type="text"
                            value={form.unit}
                            onChange={e => setForm({ ...form, unit: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder="e.g., glasses"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Frequency - Google Calendar style */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Repeat</label>
                    <select
                      value={form.frequencyPreset}
                      onChange={e => setForm({ ...form, frequencyPreset: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {FREQUENCY_PRESETS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Custom recurrence options */}
                  {form.frequencyPreset === 'custom' && (
                    <div className="space-y-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Repeat every</label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={form.repeatInterval}
                            onChange={e => setForm({ ...form, repeatInterval: e.target.value })}
                            className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            min="1"
                          />
                          <select
                            value={form.repeatUnit}
                            onChange={e => setForm({ ...form, repeatUnit: e.target.value as 'days' | 'weeks' | 'months' })}
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            {REPEAT_UNITS.map(u => (
                              <option key={u.value} value={u.value}>
                                {parseInt(form.repeatInterval) > 1 ? u.label + 's' : u.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Day of week picker - shown for weeks */}
                      {form.repeatUnit === 'weeks' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Repeat on</label>
                          <div className="flex gap-1">
                            {DAYS_OF_WEEK.map((day, idx) => (
                              <button
                                key={idx}
                                onClick={() => toggleCustomDay(idx)}
                                className={`flex-1 py-2 text-xs rounded-lg border transition-colors ${
                                  form.customDays.includes(idx)
                                    ? 'border-blue-500 bg-blue-500 text-white'
                                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                {day}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Day of month picker - shown for months */}
                      {form.repeatUnit === 'months' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">On day</label>
                          <select
                            value={form.monthDay}
                            onChange={e => setForm({ ...form, monthDay: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Flexibility Rule (hidden when one-time) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                      <div className="grid grid-cols-3 gap-2">
                        {FLEXIBILITY_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setForm({ ...form, flexibilityRule: opt.value })}
                            className={`px-3 py-2 text-sm rounded-lg border transition-colors text-left ${
                              form.flexibilityRule === opt.value
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            <div className="font-medium">{opt.label}</div>
                            <div className="text-xs opacity-70">{opt.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                  {/* Tolerance */}
                  {form.flexibilityRule === 'must_today' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Days before</label>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setForm({ ...form, toleranceBefore: Math.max(0, (parseInt(form.toleranceBefore) || 0) - 1).toString() })}
                            className="w-8 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                          >
                            <FaMinus className="text-[10px]" />
                          </button>
                          <input
                            type="number"
                            value={form.toleranceBefore}
                            onChange={e => setForm({ ...form, toleranceBefore: e.target.value })}
                            className="flex-1 px-2 py-2 text-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            min="0"
                          />
                          <button
                            onClick={() => setForm({ ...form, toleranceBefore: ((parseInt(form.toleranceBefore) || 0) + 1).toString() })}
                            className="w-8 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                          >
                            <FaPlus className="text-[10px]" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Days after</label>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setForm({ ...form, toleranceAfter: Math.max(0, (parseInt(form.toleranceAfter) || 0) - 1).toString() })}
                            className="w-8 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                          >
                            <FaMinus className="text-[10px]" />
                          </button>
                          <input
                            type="number"
                            value={form.toleranceAfter}
                            onChange={e => setForm({ ...form, toleranceAfter: e.target.value })}
                            className="flex-1 px-2 py-2 text-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            min="0"
                          />
                          <button
                            onClick={() => setForm({ ...form, toleranceAfter: ((parseInt(form.toleranceAfter) || 0) + 1).toString() })}
                            className="w-8 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                          >
                            <FaPlus className="text-[10px]" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* At Least - minimum target */}
                  {form.flexibilityRule === 'at_least' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Minimum Value</label>
                      <input
                        type="number"
                        value={form.target}
                        onChange={e => setForm({ ...form, target: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="e.g., 20"
                        min="0"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Full points at this value, exceeding is fine</p>
                    </div>
                  )}

                  {/* Limit - maximum threshold */}
                  {form.flexibilityRule === 'limit_avoid' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Maximum Value</label>
                      <input
                        type="number"
                        value={form.limitValue}
                        onChange={e => setForm({ ...form, limitValue: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="e.g., 2"
                        min="0"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Full points under this, penalty above</p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSubmit}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                    >
                      <FaCheck /> {editingTask ? 'Update' : 'Create'}
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={resetForm}
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
      </motion.div>
    </div>
  );
}
