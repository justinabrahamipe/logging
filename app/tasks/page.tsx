"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPlus, FaEdit, FaTrash, FaTimes, FaCheck, FaMinus, FaPlay, FaStop, FaUndo, FaEllipsisV, FaCopy, FaExpand, FaCompress, FaChevronRight, FaArrowRight, FaCalendarAlt } from "react-icons/fa";
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
}

interface Outcome {
  id: number;
  pillarId: number | null;
  name: string;
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
  importance: string;
  frequency: string;
  customDays: string | null;
  isWeekendTask: boolean;
  basePoints: number;
  outcomeId: number | null;
  periodId: number | null;
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
  { value: 'percentage', label: 'Percentage' },
];

const IMPORTANCE_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom Days' },
];

const FLEXIBILITY_OPTIONS = [
  { value: 'must_today', label: 'Must Today', desc: 'Must be done today' },
  { value: 'window', label: 'Window', desc: 'Can be done within a day range' },
  { value: 'limit_avoid', label: 'Limit/Avoid', desc: 'Track what to limit or avoid' },
  { value: 'carryover', label: 'Carryover', desc: 'Can be rescheduled manually' },
];

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getImportanceBadge(importance: string) {
  switch (importance) {
    case 'high': return { label: 'High', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
    case 'medium': return { label: 'Med', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' };
    case 'low': return { label: 'Low', className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' };
    default: return { label: '', className: '' };
  }
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
  const [scoreSummary, setScoreSummary] = useState<ScoreSummary | null>(null);
  const [timers, setTimers] = useState<Record<number, { running: boolean; elapsed: number; interval?: NodeJS.Timeout }>>({});
  const [pendingValues, setPendingValues] = useState<Record<number, string>>({});
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [quickAdd, setQuickAdd] = useState({ name: '', date: new Date().toISOString().split('T')[0] });
  const menuRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    pillarId: 0,
    name: '',
    completionType: 'checkbox',
    target: '',
    unit: '',
    importance: 'medium',
    frequency: 'daily',
    customDays: [] as number[],
    isWeekendTask: false,
    basePoints: '10',
    flexibilityRule: 'must_today',
    windowStart: '',
    windowEnd: '',
    limitValue: '',
    isAdhoc: false,
    outcomeId: 0,
    periodId: 0,
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
        setOutcomes(data.map((o: Outcome & { pillarId: number | null }) => ({ id: o.id, pillarId: o.pillarId, name: o.name })));
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
      const url = filter === 'today' ? `/api/tasks?date=${today}` : '/api/tasks';
      const res = await fetch(url);
      if (res.ok) {
        setGroups(await res.json());
      }
      if (filter === 'today') {
        await fetchScore();
      }
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
        t.id === taskId ? { ...t, completion: { ...t.completion, taskId, completed: completed ?? false, value: value ?? null, pointsEarned: t.completion?.pointsEarned ?? 0 } as TaskCompletion } : t
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
    handleComplete(task.id, newValue > 0, newValue);
  };

  const handleNumericSubmit = (task: Task) => {
    const raw = pendingValues[task.id];
    if (raw === undefined) return;
    const numValue = parseFloat(raw) || 0;
    handleComplete(task.id, numValue > 0, numValue);
    setPendingValues(prev => { const next = { ...prev }; delete next[task.id]; return next; });
  };

  const handlePercentageSubmit = (task: Task) => {
    const raw = pendingValues[task.id];
    if (raw === undefined) return;
    const numValue = Math.min(100, Math.max(0, parseInt(raw) || 0));
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

  const handleUndo = useCallback((taskId: number) => {
    setGroups(prev => prev.map(g => ({
      ...g,
      tasks: g.tasks.map(t =>
        t.id === taskId ? { ...t, completion: { ...t.completion, taskId, completed: false, value: 0, pointsEarned: 0 } as TaskCompletion } : t
      ),
    })));

    fetch('/api/tasks/complete/undo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, date: today }),
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
    }).catch(err => console.error("Failed to undo completion:", err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

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
    setForm({
      pillarId: task.pillarId,
      name: task.name + ' (copy)',
      completionType: task.completionType,
      target: task.target?.toString() || '',
      unit: task.unit || '',
      importance: task.importance,
      frequency: task.frequency === 'adhoc' ? 'daily' : task.frequency,
      customDays: task.customDays ? JSON.parse(task.customDays) : [],
      isWeekendTask: task.isWeekendTask,
      basePoints: task.basePoints.toString(),
      flexibilityRule: task.flexibilityRule,
      windowStart: task.windowStart?.toString() || '',
      windowEnd: task.windowEnd?.toString() || '',
      limitValue: task.limitValue?.toString() || '',
      isAdhoc: task.frequency === 'adhoc',
      outcomeId: task.outcomeId || 0,
      periodId: task.periodId || 0,
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;

    const body: Record<string, unknown> = {
      pillarId: form.pillarId || null,
      name: form.name,
      completionType: form.completionType,
      importance: form.importance,
      frequency: form.isAdhoc ? 'adhoc' : form.frequency,
      isWeekendTask: form.isWeekendTask,
      basePoints: parseFloat(form.basePoints) || 10,
      flexibilityRule: form.isAdhoc ? 'must_today' : form.flexibilityRule,
    };

    if (form.outcomeId) body.outcomeId = form.outcomeId;
    if (form.periodId) body.periodId = form.periodId;
    if (form.target) body.target = parseFloat(form.target);
    if (form.unit) body.unit = form.unit;
    if (form.frequency === 'custom' && !form.isAdhoc) body.customDays = JSON.stringify(form.customDays);
    if (form.flexibilityRule === 'window' && !form.isAdhoc) {
      if (form.windowStart) body.windowStart = parseInt(form.windowStart);
      if (form.windowEnd) body.windowEnd = parseInt(form.windowEnd);
    }
    if (form.flexibilityRule === 'limit_avoid' && !form.isAdhoc) {
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
      importance: 'medium',
      frequency: 'daily',
      customDays: [],
      isWeekendTask: false,
      basePoints: '10',
      flexibilityRule: 'must_today',
      windowStart: '',
      windowEnd: '',
      limitValue: '',
      isAdhoc: false,
      outcomeId: 0,
      periodId: 0,
    });
  };

  const startEdit = (task: Task) => {
    setEditingTask(task);
    setForm({
      pillarId: task.pillarId,
      name: task.name,
      completionType: task.completionType,
      target: task.target?.toString() || '',
      unit: task.unit || '',
      importance: task.importance,
      frequency: task.frequency === 'adhoc' ? 'daily' : task.frequency,
      customDays: task.customDays ? JSON.parse(task.customDays) : [],
      isWeekendTask: task.isWeekendTask,
      basePoints: task.basePoints.toString(),
      flexibilityRule: task.flexibilityRule,
      windowStart: task.windowStart?.toString() || '',
      windowEnd: task.windowEnd?.toString() || '',
      limitValue: task.limitValue?.toString() || '',
      isAdhoc: task.frequency === 'adhoc',
      outcomeId: task.outcomeId || 0,
      periodId: task.periodId || 0,
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
      importance: 'medium',
      basePoints: 10,
    };
    if (quickAdd.date) body.scheduledDate = quickAdd.date;
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
      importance: 'medium',
      frequency: 'daily',
      customDays: [],
      isWeekendTask: false,
      basePoints: '10',
      flexibilityRule: 'must_today',
      windowStart: '',
      windowEnd: '',
      limitValue: '',
      isAdhoc: true,
      outcomeId: 0,
      periodId: 0,
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
              {isToday
                ? new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                : 'All tasks across all days'}
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

        {/* Filter Toggle + Focus */}
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
          {isToday && (
            <button
              onClick={() => setFocusMode(true)}
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5"
            >
              <FaExpand className="text-xs" /> Focus
            </button>
          )}
        </div>

        {/* Quick-Add Bar */}
        {isToday && (
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
        )}

        {/* Score Summary Bar (Today only) */}
        {isToday && scoreSummary && (
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
            <p className="text-base mb-1">{isToday ? 'No tasks for today' : 'No tasks yet'}</p>
            <p className="text-sm">{isToday ? 'Add tasks or switch to All to see everything' : 'Click Add Task to create one'}</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {groups.flatMap((group) =>
            group.tasks.map((task) => {
                  const badge = getImportanceBadge(task.importance);
                  const isCompleted = task.completion?.completed || false;
                  const currentValue = task.completion?.value || 0;

                  return (
                    <div
                      key={task.id}
                      className={`rounded-xl p-5 transition-all ${
                        isToday && isCompleted
                          ? 'bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800'
                          : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                      style={{ borderLeftWidth: 4, borderLeftColor: isToday && isCompleted ? '#4ade80' : group.pillar.color }}
                    >
                      {/* Row 1: name + pillar + menu */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className={`text-base font-semibold leading-snug truncate ${isToday && isCompleted ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                            {task.name}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
                            <span>{group.pillar.emoji}</span>
                            <span>{group.pillar.name}</span>
                          </p>
                        </div>
                        <div className="relative shrink-0" ref={openMenuId === task.id ? menuRef : undefined}>
                          <button
                            onClick={() => setOpenMenuId(openMenuId === task.id ? null : task.id)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <FaEllipsisV className="text-xs" />
                          </button>
                          <AnimatePresence>
                            {openMenuId === task.id && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.1 }}
                                className="absolute right-0 top-9 z-20 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                              >
                                <button
                                  onClick={() => { setOpenMenuId(null); startEdit(task); }}
                                  className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  <FaEdit className="text-xs" /> Edit
                                </button>
                                <button
                                  onClick={() => handleCopy(task)}
                                  className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  <FaCopy className="text-xs" /> Duplicate
                                </button>
                                <button
                                  onClick={() => { setOpenMenuId(null); handleDelete(task.id); }}
                                  className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                >
                                  <FaTrash className="text-xs" /> Delete
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      {/* Row 2: Badges */}
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                        {task.frequency === 'adhoc' && (
                          <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                            Ad-hoc
                          </span>
                        )}
                        {task.outcomeId && outcomes.find(o => o.id === task.outcomeId) && (
                          <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 truncate max-w-[150px]">
                            {outcomes.find(o => o.id === task.outcomeId)?.name}
                          </span>
                        )}
                      </div>

                      {/* Row 3: Completion controls or meta */}
                      {isToday ? (
                        <div className="flex items-center gap-2.5 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                          {task.completionType === 'checkbox' && (
                            <motion.button
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleCheckboxToggle(task)}
                              className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-colors ${
                                isCompleted
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'border-gray-300 dark:border-gray-600 hover:border-green-500'
                              }`}
                            >
                              {isCompleted && <FaCheck className="text-sm" />}
                            </motion.button>
                          )}

                          {task.completionType === 'count' && (
                            <div className="flex items-center gap-2">
                              <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleCountChange(task, -1)}
                                className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600"
                              >
                                <FaMinus className="text-xs" />
                              </motion.button>
                              <span className={`text-sm font-bold min-w-[3rem] text-center ${
                                task.target && currentValue >= task.target ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'
                              }`}>
                                {currentValue}/{task.target || '?'}
                              </span>
                              <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleCountChange(task, 1)}
                                className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600"
                              >
                                <FaPlus className="text-xs" />
                              </motion.button>
                            </div>
                          )}

                          {task.completionType === 'duration' && (
                            <div className="flex items-center gap-2">
                              {timers[task.id]?.running ? (
                                <span className="text-sm font-mono text-gray-700 dark:text-gray-300 w-14 text-center">
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
                                    className="w-16 px-2 py-1.5 text-sm text-right border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                  />
                                  <span className="text-xs text-gray-500 dark:text-gray-400">min</span>
                                  {pendingValues[task.id] !== undefined && (
                                    <motion.button
                                      whileTap={{ scale: 0.9 }}
                                      onClick={() => handleDurationManualSubmit(task)}
                                      className="w-8 h-8 rounded-lg bg-green-500 text-white flex items-center justify-center hover:bg-green-600"
                                    >
                                      <FaCheck className="text-xs" />
                                    </motion.button>
                                  )}
                                </>
                              )}
                              <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleTimerToggle(task)}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                  timers[task.id]?.running
                                    ? 'bg-red-500 text-white'
                                    : 'bg-blue-500 text-white'
                                }`}
                              >
                                {timers[task.id]?.running ? <FaStop className="text-xs" /> : <FaPlay className="text-xs" />}
                              </motion.button>
                            </div>
                          )}

                          {task.completionType === 'numeric' && (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={pendingValues[task.id] ?? (currentValue || '')}
                                onChange={(e) => setPendingValues(prev => ({ ...prev, [task.id]: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && handleNumericSubmit(task)}
                                placeholder={task.target ? String(task.target) : '0'}
                                className="w-20 px-2 py-1.5 text-sm text-right border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                              {pendingValues[task.id] !== undefined && (
                                <motion.button
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleNumericSubmit(task)}
                                  className="w-8 h-8 rounded-lg bg-green-500 text-white flex items-center justify-center hover:bg-green-600"
                                >
                                  <FaCheck className="text-xs" />
                                </motion.button>
                              )}
                            </div>
                          )}

                          {task.completionType === 'percentage' && (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={pendingValues[task.id] ?? (currentValue || '')}
                                onChange={(e) => setPendingValues(prev => ({ ...prev, [task.id]: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && handlePercentageSubmit(task)}
                                placeholder="0"
                                className="w-16 px-2 py-1.5 text-sm text-right border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                              <span className="text-sm text-gray-500 dark:text-gray-400">%</span>
                              {pendingValues[task.id] !== undefined && (
                                <motion.button
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handlePercentageSubmit(task)}
                                  className="w-8 h-8 rounded-lg bg-green-500 text-white flex items-center justify-center hover:bg-green-600"
                                >
                                  <FaCheck className="text-xs" />
                                </motion.button>
                              )}
                            </div>
                          )}

                          {/* Undo button */}
                          {isCompleted && (
                            <motion.button
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleUndo(task.id)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors ml-auto"
                              title="Undo completion"
                            >
                              <FaUndo className="text-xs" />
                            </motion.button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                          <span className="capitalize">{task.completionType}</span>
                          {task.target && <span>Target: {task.target} {task.unit || ''}</span>}
                          {task.frequency !== 'adhoc' && <span className="capitalize">{task.frequency}</span>}
                        </div>
                      )}
                    </div>
                  );
                })
          )}
        </div>

        {/* Focus Mode Overlay */}
        <AnimatePresence>
          {focusMode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-white dark:bg-gray-900 overflow-y-auto"
            >
              <div className="max-w-2xl mx-auto px-4 py-6">
                {/* Exit button */}
                <button
                  onClick={() => setFocusMode(false)}
                  className="fixed top-4 right-4 z-[101] px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors flex items-center gap-1.5 shadow-lg"
                >
                  <FaCompress className="text-xs" /> Exit Focus
                </button>

                {/* Score bar */}
                {scoreSummary && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl font-bold text-gray-900 dark:text-white">
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
                    <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(scoreSummary.actionScore, 100)}%` }}
                        transition={{ duration: 0.5 }}
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                      />
                    </div>
                  </div>
                )}

                {/* Task groups */}
                {groups.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <p className="text-lg">No tasks for today</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {groups.flatMap((group) =>
                      group.tasks.map((task) => {
                            const isCompleted = task.completion?.completed || false;
                            const currentValue = task.completion?.value || 0;

                            return (
                              <div
                                key={task.id}
                                className={`rounded-lg h-[68px] flex flex-col justify-between p-2.5 pl-3 transition-colors ${
                                  isCompleted
                                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                                    : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700'
                                }`}
                                style={{ borderLeftWidth: 3, borderLeftColor: isCompleted ? '#4ade80' : group.pillar.color }}
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-xs shrink-0" title={group.pillar.name}>{group.pillar.emoji}</span>
                                  <span className={`text-sm font-medium leading-tight truncate ${isCompleted ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                                    {task.name}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  {task.completionType === 'checkbox' && (
                                    <motion.button
                                      whileTap={{ scale: 0.9 }}
                                      onClick={() => handleCheckboxToggle(task)}
                                      className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                                        isCompleted
                                          ? 'bg-green-500 border-green-500 text-white'
                                          : 'border-gray-300 dark:border-gray-600 hover:border-green-500'
                                      }`}
                                    >
                                      {isCompleted && <FaCheck className="text-[10px]" />}
                                    </motion.button>
                                  )}

                                  {task.completionType === 'count' && (
                                    <div className="flex items-center gap-1">
                                      <motion.button
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => handleCountChange(task, -1)}
                                        className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600"
                                      >
                                        <FaMinus className="text-[10px]" />
                                      </motion.button>
                                      <span className={`text-xs font-bold ${
                                        task.target && currentValue >= task.target ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'
                                      }`}>
                                        {currentValue}/{task.target || '?'}
                                      </span>
                                      <motion.button
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => handleCountChange(task, 1)}
                                        className="w-6 h-6 rounded bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600"
                                      >
                                        <FaPlus className="text-[10px]" />
                                      </motion.button>
                                    </div>
                                  )}

                                  {task.completionType === 'duration' && (
                                    <div className="flex items-center gap-1">
                                      {timers[task.id]?.running ? (
                                        <span className="text-xs font-mono text-gray-700 dark:text-gray-300">
                                          {formatTime(timers[task.id].elapsed)}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                          {currentValue ? `${currentValue}m` : '0m'}
                                        </span>
                                      )}
                                      <motion.button
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => handleTimerToggle(task)}
                                        className={`w-6 h-6 rounded flex items-center justify-center ${
                                          timers[task.id]?.running ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
                                        }`}
                                      >
                                        {timers[task.id]?.running ? <FaStop className="text-[10px]" /> : <FaPlay className="text-[10px]" />}
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
                                        className="w-12 px-1 py-0.5 text-xs text-right border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                      />
                                      {pendingValues[task.id] !== undefined && (
                                        <motion.button
                                          whileTap={{ scale: 0.9 }}
                                          onClick={() => handleNumericSubmit(task)}
                                          className="w-6 h-6 rounded bg-green-500 text-white flex items-center justify-center hover:bg-green-600"
                                        >
                                          <FaCheck className="text-[10px]" />
                                        </motion.button>
                                      )}
                                    </div>
                                  )}

                                  {task.completionType === 'percentage' && (
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={pendingValues[task.id] ?? (currentValue || '')}
                                        onChange={(e) => setPendingValues(prev => ({ ...prev, [task.id]: e.target.value }))}
                                        onKeyDown={(e) => e.key === 'Enter' && handlePercentageSubmit(task)}
                                        placeholder="0"
                                        className="w-10 px-1 py-0.5 text-xs text-right border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                      />
                                      <span className="text-[10px] text-gray-500">%</span>
                                      {pendingValues[task.id] !== undefined && (
                                        <motion.button
                                          whileTap={{ scale: 0.9 }}
                                          onClick={() => handlePercentageSubmit(task)}
                                          className="w-6 h-6 rounded bg-green-500 text-white flex items-center justify-center hover:bg-green-600"
                                        >
                                          <FaCheck className="text-[10px]" />
                                        </motion.button>
                                      )}
                                    </div>
                                  )}

                                  {isCompleted && (
                                    <motion.button
                                      whileTap={{ scale: 0.9 }}
                                      onClick={() => handleUndo(task.id)}
                                      className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-orange-500 transition-colors ml-auto"
                                      title="Undo"
                                    >
                                      <FaUndo className="text-[10px]" />
                                    </motion.button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                  {/* Pillar */}
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

                  {/* Linked Outcome */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Linked Outcome (optional)</label>
                    <select
                      value={form.outcomeId}
                      onChange={e => setForm({ ...form, outcomeId: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value={0}>None</option>
                      {outcomes
                        .filter(o => !form.pillarId || o.pillarId === form.pillarId || !o.pillarId)
                        .map(o => (
                          <option key={o.id} value={o.id}>{o.name}</option>
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

                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Task Name</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="e.g., Gym session"
                    />
                  </div>

                  {/* Completion Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Completion Type</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target</label>
                        <input
                          type="number"
                          value={form.target}
                          onChange={e => setForm({ ...form, target: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="e.g., 8"
                        />
                      </div>
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
                    </div>
                  )}

                  {/* Importance */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Importance</label>
                    <div className="flex gap-2">
                      {IMPORTANCE_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setForm({ ...form, importance: opt.value })}
                          className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                            form.importance === opt.value
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 font-bold'
                              : 'border-gray-300 dark:border-gray-600'
                          } text-gray-700 dark:text-gray-300`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Ad-hoc toggle */}
                  <div
                    onClick={() => setForm({ ...form, isAdhoc: !form.isAdhoc })}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer"
                  >
                    <div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">Ad-hoc (one-time)</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Only appears today, not on future days</p>
                    </div>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      form.isAdhoc ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {form.isAdhoc && <FaCheck className="text-xs" />}
                    </div>
                  </div>

                  {/* Frequency (hidden when adhoc) */}
                  {!form.isAdhoc && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Frequency</label>
                      <div className="flex gap-2">
                        {FREQUENCY_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setForm({ ...form, frequency: opt.value })}
                            className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                              form.frequency === opt.value
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 font-bold'
                                : 'border-gray-300 dark:border-gray-600'
                            } text-gray-700 dark:text-gray-300`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom Days */}
                  {!form.isAdhoc && form.frequency === 'custom' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Days</label>
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

                  {/* Flexibility Rule (hidden when adhoc) */}
                  {!form.isAdhoc && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Flexibility Rule</label>
                      <div className="grid grid-cols-2 gap-2">
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
                  )}

                  {/* Window fields */}
                  {!form.isAdhoc && form.flexibilityRule === 'window' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Window Start (days)</label>
                        <input
                          type="number"
                          value={form.windowStart}
                          onChange={e => setForm({ ...form, windowStart: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="e.g., 0"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Window End (days)</label>
                        <input
                          type="number"
                          value={form.windowEnd}
                          onChange={e => setForm({ ...form, windowEnd: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="e.g., 3"
                          min="0"
                        />
                      </div>
                    </div>
                  )}

                  {/* Limit/Avoid fields */}
                  {!form.isAdhoc && form.flexibilityRule === 'limit_avoid' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Limit Value (max threshold)</label>
                      <input
                        type="number"
                        value={form.limitValue}
                        onChange={e => setForm({ ...form, limitValue: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="e.g., 2"
                        min="0"
                      />
                    </div>
                  )}

                  {/* Weekend Task (hidden when adhoc) */}
                  {!form.isAdhoc && (
                    <div
                      onClick={() => setForm({ ...form, isWeekendTask: !form.isWeekendTask })}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer"
                    >
                      <span className="text-sm text-gray-700 dark:text-gray-300">Weekend-only task</span>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        form.isWeekendTask ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 dark:border-gray-600'
                      }`}>
                        {form.isWeekendTask && <FaCheck className="text-xs" />}
                      </div>
                    </div>
                  )}

                  {/* Base Points */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Base Points</label>
                    <input
                      type="number"
                      value={form.basePoints}
                      onChange={e => setForm({ ...form, basePoints: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

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
