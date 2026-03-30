"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { DEMO_TASK_GROUPS, DEMO_PILLARS } from "@/lib/demo-data";
import { useTheme } from "@/components/ThemeProvider";
import { formatDate, getTodayString, getYesterdayString } from "@/lib/format";
import { formatScheduleLabel } from "@/lib/constants";
import type { Pillar, Task, TaskCompletion, TaskGroup, Outcome, Cycle } from "@/lib/types";

export interface ScoreSummary {
  actionScore: number;
  scoreTier: string;
  completedTasks: number;
  totalTasks: number;
}

export type DateFilterType = 'today' | 'yesterday' | 'tomorrow' | 'week' | 'month' | 'single' | 'range' | 'no-date' | 'scheduled';

export interface TaskFilters {
  date: { type: DateFilterType; value?: string; endDate?: string };
  status: 'all' | 'todo' | 'done' | 'discarded';
  pillars: number[];
  goals: number[];
}

export interface PastDay {
  date: string;
  tasks: {
    id: number;
    name: string;
    completionType: string;
    target: number | null;
    unit: string | null;
    goalId: number | null;
    pillarName: string | null;
    pillarColor: string | null;
    pillarEmoji: string | null;
    completed: boolean;
    value: number | null;
    isHighlighted: boolean;
  }[];
}


function getDateBucket(task: { frequency: string; customDays?: string | null; createdAt?: unknown; repeatInterval?: number | null; startDate?: string | null; goalId?: number | null }, todayStr: string): string {
  if (task.frequency === 'daily' && (!task.startDate || task.startDate <= todayStr)) return 'Today';

  const today = new Date(todayStr + 'T12:00:00');

  for (let i = 0; i <= 60; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dStr = d.toISOString().split('T')[0];

    if (task.startDate && dStr < task.startDate) continue;

    let matches = false;
    const dow = d.getDay();
    if (task.frequency === 'adhoc') {
      if (!task.startDate) return 'No Date';
      // Only manual adhoc tasks (no goal) show as overdue today
      if (!task.goalId && task.startDate < todayStr && i === 0) return 'Today';
      if (task.startDate === todayStr && i === 0) return 'Today';
      matches = dStr === task.startDate;
    } else if (task.frequency === 'custom' && task.customDays) {
      try {
        const days: number[] = JSON.parse(task.customDays);
        matches = days.includes(dow);
        // Check week interval if set (every N weeks)
        if (matches && task.repeatInterval && task.repeatInterval > 7) {
          let anchorStr = task.startDate;
          if (!anchorStr && task.createdAt) {
            const cd = new Date(task.createdAt as string | number | Date);
            anchorStr = `${cd.getFullYear()}-${String(cd.getMonth() + 1).padStart(2, '0')}-${String(cd.getDate()).padStart(2, '0')}`;
          }
          if (anchorStr) {
            const diffMs = d.getTime() - new Date(anchorStr + 'T12:00:00').getTime();
            const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
            const weekInterval = Math.round(task.repeatInterval / 7);
            const diffWeeks = Math.floor(diffDays / 7);
            matches = diffWeeks >= 0 && diffWeeks % weekInterval === 0;
          }
        }
      } catch { matches = false; }
    } else if (task.frequency === 'monthly' && task.customDays) {
      try {
        const days: number[] = JSON.parse(task.customDays);
        matches = days.includes(d.getDate());
      } catch { matches = false; }
    } else if (task.frequency === 'interval' && task.repeatInterval) {
      let anchorStr = task.startDate;
      if (!anchorStr && task.createdAt) {
        const cd = new Date(task.createdAt as string | number | Date);
        anchorStr = `${cd.getFullYear()}-${String(cd.getMonth() + 1).padStart(2, '0')}-${String(cd.getDate()).padStart(2, '0')}`;
      }
      if (anchorStr) {
        const diffMs = d.getTime() - new Date(anchorStr + 'T12:00:00').getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        matches = diffDays >= 0 && diffDays % task.repeatInterval === 0;
      }
    } else if (task.frequency === 'weekly') {
      matches = dow === 1;
    }

    if (!matches) continue;

    if (i === 0) return 'Today';
    if (i === 1) return 'Tomorrow';
    if (i <= 6) return dStr;
    return 'Later';
  }
  return 'No Date';
}

export { getDateBucket };

function taskToPreset(task: { frequency: string; customDays?: string | null; repeatInterval?: number | null }): {
  preset: string; repeatInterval: string; repeatUnit: 'days' | 'weeks' | 'months'; customDays: number[]; monthDay: number
} {
  const customDays = task.customDays ? JSON.parse(task.customDays) : [];

  if (task.frequency === 'adhoc') return { preset: 'adhoc', repeatInterval: '1', repeatUnit: 'days', customDays: [], monthDay: 1 };
  if (task.frequency === 'daily') return { preset: 'daily', repeatInterval: '1', repeatUnit: 'days', customDays: [], monthDay: 1 };

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

export function useTasksPage() {
  const { data: session, status } = useSession();
  const { dateFormat } = useTheme();
  const router = useRouter();
  const [groups, setGroups] = useState<TaskGroup[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('tasks-cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.date === getTodayString()) return parsed.groups || [];
        }
      } catch { /* ignore */ }
    }
    return [];
  });
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [goalsList, setGoalsList] = useState<Outcome[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const hasCachedData = typeof window !== 'undefined' && (() => {
    try {
      const cached = localStorage.getItem('tasks-cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        return parsed.date === getTodayString() && (parsed.groups?.length > 0);
      }
    } catch { /* ignore */ }
    return false;
  })();
  const [loading, setLoading] = useState(!hasCachedData);
  const [refreshing, setRefreshing] = useState(false);
  const [noDateTasks, setNoDateTasks] = useState<Task[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('tasks-cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.date === getTodayString()) return parsed.noDateTasks || [];
        }
      } catch { /* ignore */ }
    }
    return [];
  });
  const [pastDays, setPastDays] = useState<PastDay[]>([]);
  const [filters, setFilters] = useState<TaskFilters>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tasks-filters');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return {
            date: parsed.date || { type: 'today' },
            status: parsed.status || 'all',
            pillars: [] as number[],
            goals: [] as number[],
          };
        } catch { /* ignore */ }
      }
    }
    return { date: { type: 'today' as const }, status: 'all' as const, pillars: [] as number[], goals: [] as number[] };
  });
  const [activePopover, setActivePopover] = useState<null | 'add' | 'date' | 'status' | 'pillar' | 'goal'>(null);
  const [datePickerMode, setDatePickerMode] = useState<null | 'single' | 'range'>(null);
  const [pendingRange, setPendingRange] = useState<{ from: Date; to?: Date } | undefined>(undefined);
  const [scoreSummary, setScoreSummary] = useState<ScoreSummary | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('tasks-cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.date === getTodayString() && parsed.scoreSummary) return parsed.scoreSummary;
        }
      } catch { /* ignore */ }
    }
    return null;
  });
  const [timers, setTimers] = useState<Record<number, { running: boolean; elapsed: number; interval?: NodeJS.Timeout }>>({});

  // Persist timer state to database
  const saveTimerToDb = (taskId: number, action: 'start' | 'stop') => {
    fetch('/api/tasks/timer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, action }),
    }).catch(() => {});
  };

  // Restore running timers from task data after groups load
  const timerRestoredRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    const allTasks = groups.flatMap(g => g.tasks);
    for (const task of allTasks) {
      if (task.completion?.timerStartedAt && !timerRestoredRef.current.has(task.id) && !timers[task.id]?.running) {
        timerRestoredRef.current.add(task.id);
        const elapsedAtStart = (task.completion?.value || 0) * 60;
        const elapsedSinceStart = Math.floor((Date.now() - task.completion.timerStartedAt) / 1000);
        const totalElapsed = elapsedAtStart + elapsedSinceStart;
        startTimerInternal(task.id, totalElapsed);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);
  const [pendingValues, setPendingValues] = useState<Record<number, string>>({});
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});
  const [authSnackbar, setAuthSnackbar] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const today = getTodayString();
  const yesterday = getYesterdayString();
  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })();
  const viewDate = filters.date.type === 'yesterday' ? yesterday : filters.date.type === 'tomorrow' ? tomorrow : (filters.date.type === 'single' && filters.date.value) ? filters.date.value : today;

  // Date label for chip display
  const getDateLabel = useCallback(() => {
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const todayDate = new Date(today + 'T12:00:00');
    switch (filters.date.type) {
      case 'today': return `Today (${fmt(todayDate)})`;
      case 'yesterday': { const d = new Date(todayDate); d.setDate(d.getDate() - 1); return `Yesterday (${fmt(d)})`; }
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

  // Fetch tasks + score when date filter changes
  useEffect(() => {
    if (filters.date.type === 'today') {
      fetchDateTasks(today);
      fetchScore(today);
    } else if (filters.date.type === 'yesterday') {
      fetchDateTasks(yesterday);
      fetchScore(yesterday);
    } else if (filters.date.type === 'tomorrow') {
      fetchDateTasks(tomorrow);
      fetchScore(today);
    } else if (filters.date.type === 'single' && filters.date.value) {
      fetchDateTasks(filters.date.value);
      fetchScore(filters.date.value < today ? filters.date.value : today);
    } else {
      setPastDays([]);
      fetchTasks();
      fetchScore(today);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.date.type, filters.date.value]);

  useEffect(() => {
    if (status === "unauthenticated") {
      setPillars(DEMO_PILLARS.map(p => ({ id: p.id, name: p.name, emoji: p.emoji, color: p.color })));
      setGroups(DEMO_TASK_GROUPS.map(g => ({
        pillar: { id: g.pillarId, name: g.pillarName, emoji: g.pillarEmoji, color: g.pillarColor },
        tasks: g.tasks.map(t => ({
          ...t, frequency: t.frequency, customDays: null, repeatInterval: null,
          goalId: null, periodId: null, startDate: null,
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
      // Initial fetch uses server-filtered path for today/yesterday/tomorrow/single
      if (filters.date.type === 'today') {
        fetchDateTasks(today);
      } else if (filters.date.type === 'yesterday') {
        fetchDateTasks(yesterday);
      } else if (filters.date.type === 'tomorrow') {
        fetchDateTasks(tomorrow);
      } else if (filters.date.type === 'single' && filters.date.value) {
        fetchDateTasks(filters.date.value);
      } else {
        fetchTasks();
      }
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
      const res = await fetch('/api/goals');
      if (res.ok) {
        const data = await res.json();
        setGoalsList(data.map((o: Outcome) => ({ id: o.id, pillarId: o.pillarId, name: o.name, goalType: o.goalType || 'outcome', startValue: o.startValue, targetValue: o.targetValue, startDate: o.startDate, targetDate: o.targetDate, scheduleDays: o.scheduleDays, unit: o.unit })));
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

  const saveTasksCache = (cacheGroups: TaskGroup[], cacheNoDateTasks: Task[], cacheScore: ScoreSummary | null) => {
    try {
      localStorage.setItem('tasks-cache', JSON.stringify({
        date: today,
        groups: cacheGroups,
        noDateTasks: cacheNoDateTasks,
        scoreSummary: cacheScore,
      }));
    } catch { /* ignore quota errors */ }
  };

  const fetchTasks = async () => {
    try {
      if (!loading) setRefreshing(true);
      const url = `/api/tasks?date=${today}&all=true`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
        saveTasksCache(data, [], scoreSummary);
      }
      await fetchScore(today);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchScore = async (date?: string) => {
    try {
      const res = await fetch(`/api/daily-score?date=${date || today}`);
      if (res.ok) {
        const data = await res.json();
        const newScore = {
          actionScore: data.actionScore,
          scoreTier: data.scoreTier,
          completedTasks: data.completedTasks,
          totalTasks: data.totalTasks,
        };
        setScoreSummary(newScore);
        // Update cache with new score
        try {
          const cached = localStorage.getItem('tasks-cache');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.date === today) {
              parsed.scoreSummary = newScore;
              localStorage.setItem('tasks-cache', JSON.stringify(parsed));
            }
          }
        } catch { /* ignore */ }
        try { sessionStorage.removeItem('header-stats'); } catch { /* ignore */ }
        window.dispatchEvent(new Event('score-updated'));
      }
    } catch (error) {
      console.error("Failed to fetch score:", error);
    }
  };

  const fetchDateTasks = async (date: string) => {
    try {
      if (!loading) setRefreshing(true);
      const res = await fetch(`/api/tasks?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        let newGroups: TaskGroup[];
        let newNoDateTasks: Task[];
        if (data.groups) {
          newGroups = data.groups;
          newNoDateTasks = data.noDateTasks || [];
        } else {
          newGroups = data;
          newNoDateTasks = [];
        }
        setGroups(newGroups);
        setNoDateTasks(newNoDateTasks);
        if (date === today) {
          saveTasksCache(newGroups, newNoDateTasks, scoreSummary);
        }
      }
    } catch (error) {
      console.error("Failed to fetch tasks for date:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refreshView = async () => {
    const isServerFiltered = filters.date.type === 'today' ||
      filters.date.type === 'yesterday' ||
      filters.date.type === 'tomorrow' ||
      (filters.date.type === 'single' && !!filters.date.value);
    if (isServerFiltered) {
      const refreshDate = filters.date.type === 'tomorrow' ? tomorrow : viewDate;
      await fetchDateTasks(refreshDate);
    } else {
      await fetchTasks();
    }
    await fetchScore(viewDate);
  };

  // --- Completion handlers ---
  const handleComplete = useCallback(async (taskId: number, completed?: boolean, value?: number) => {
    if (status !== "authenticated") { setAuthSnackbar(true); return; }

    setActionLoading(prev => ({ ...prev, [taskId]: true }));
    try {
      const body: Record<string, unknown> = { taskId, date: viewDate };
      if (completed !== undefined) body.completed = completed;
      if (value !== undefined) body.value = value;

      const res = await fetch('/api/tasks/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const completion = await res.json();
        // Check if this is a no-date task being completed (needs to move into groups)
        const noDateTask = noDateTasks.find(t => t.id === taskId);
        if (noDateTask && completed) {
          setNoDateTasks(prev => prev.filter(t => t.id !== taskId));
          setGroups(prev => {
            const updated = prev.map(g => ({
              ...g,
              tasks: g.tasks.map(t => t.id === taskId ? { ...t, completion } : t),
            }));
            const alreadyInGroup = updated.some(g => g.tasks.some(t => t.id === taskId));
            if (!alreadyInGroup) {
              const taskWithCompletion = { ...noDateTask, completion };
              const group = updated.find(g => g.pillar.id === (noDateTask.pillarId || 0));
              if (group) {
                return updated.map(g => g === group ? { ...g, tasks: [...g.tasks, taskWithCompletion] } : g);
              }
              // No matching group — add to first group or create a fallback
              if (updated.length > 0) {
                return updated.map((g, i) => i === 0 ? { ...g, tasks: [...g.tasks, taskWithCompletion] } : g);
              }
            }
            return updated;
          });
        } else {
          setGroups(prev => prev.map(g => ({
            ...g,
            tasks: g.tasks.map(t =>
              t.id === taskId ? { ...t, completion } : t
            ),
          })));
        }
        fetchScore(viewDate);
      }
    } catch (err) {
      console.error("Failed to complete task:", err);
    } finally {
      setActionLoading(prev => ({ ...prev, [taskId]: false }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, viewDate]);

  const handleCheckboxToggle = (task: Task) => {
    const isCurrentlyCompleted = task.completion?.completed || false;
    handleComplete(task.id, !isCurrentlyCompleted, !isCurrentlyCompleted ? 1 : 0);
  };

  const handleCountChange = (task: Task, delta: number) => {
    const current = task.completion?.value || 0;
    const newValue = Math.max(0, current + delta);
    const isLimit = task.flexibilityRule === 'limit_avoid';
    // Limit tasks never auto-complete — user must manually mark done
    const completed = isLimit ? (task.completion?.completed || false) : (task.target ? newValue >= task.target : newValue > 0);
    handleComplete(task.id, completed, newValue);
  };

  const handleNumericSubmit = (task: Task) => {
    const raw = pendingValues[task.id];
    if (raw === undefined) return;
    const numValue = parseFloat(raw) || 0;
    const isLimit = task.flexibilityRule === 'limit_avoid';
    const completed = isLimit ? (task.completion?.completed || false) : (task.target && task.target > 0 ? numValue >= task.target : numValue > 0);
    handleComplete(task.id, completed, numValue);
    setPendingValues(prev => { const next = { ...prev }; delete next[task.id]; return next; });
  };

  const handleMarkDone = (task: Task) => {
    const currentValue = task.completion?.value || 0;
    handleComplete(task.id, true, currentValue);
  };

  const startTimerInternal = (taskId: number, startElapsed: number) => {
    const interval = setInterval(() => {
      setTimers(prev => {
        const current = prev[taskId];
        if (!current?.running) return prev;
        return { ...prev, [taskId]: { ...current, elapsed: current.elapsed + 1 } };
      });
    }, 1000);
    setTimers(prev => ({ ...prev, [taskId]: { running: true, elapsed: startElapsed, interval } }));
  };

  const startTimer = (taskId: number, startElapsed: number) => {
    startTimerInternal(taskId, startElapsed);
    saveTimerToDb(taskId, 'start');
  };

  const handleTimerToggle = (task: Task) => {
    const timer = timers[task.id];
    if (timer?.running) {
      // Pause: save progress, only mark complete if target reached
      clearInterval(timer.interval);
      const minutes = Math.round(timer.elapsed / 60);
      const isLimit = task.flexibilityRule === 'limit_avoid';
      const targetReached = isLimit ? (task.completion?.completed || false) : (task.target ? timer.elapsed >= task.target * 60 : minutes > 0);
      handleComplete(task.id, targetReached, minutes);
      setTimers(prev => ({ ...prev, [task.id]: { running: false, elapsed: timer.elapsed } }));
      saveTimerToDb(task.id, 'stop');
    } else {
      // Resume: continue from current elapsed time
      const elapsed = timer?.elapsed || ((task.completion?.value || 0) * 60);
      startTimer(task.id, elapsed);
    }
  };

  const handleDurationManualSubmit = (task: Task) => {
    const raw = pendingValues[task.id];
    if (raw === undefined) return;
    const minutes = parseFloat(raw) || 0;
    const elapsedSec = minutes * 60;
    // Update elapsed time without starting timer
    setTimers(prev => ({ ...prev, [task.id]: { running: false, elapsed: elapsedSec } }));
    saveTimerToDb(task.id, 'stop');
    // Only mark complete if target is reached (limit tasks never auto-complete)
    const isLimit = task.flexibilityRule === 'limit_avoid';
    const targetReached = isLimit ? (task.completion?.completed || false) : (task.target ? elapsedSec >= task.target * 60 : minutes > 0);
    handleComplete(task.id, targetReached, minutes);
    setPendingValues(prev => { const next = { ...prev }; delete next[task.id]; return next; });
  };

  const handleHighlightToggle = useCallback(async (taskId: number) => {
    const allTasks = groups.flatMap(g => g.tasks);
    const groupTask = allTasks.find(t => t.id === taskId);
    const currentlyHighlighted = groupTask?.completion?.isHighlighted || false;

    if (!currentlyHighlighted) {
      const highlightedCount = allTasks.filter(t => t.completion?.isHighlighted).length;
      if (highlightedCount >= 3) return;
    }

    setActionLoading(prev => ({ ...prev, [taskId]: true }));
    try {
      const res = await fetch('/api/tasks/highlight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, date: viewDate, isHighlighted: !currentlyHighlighted }),
      });
      if (res.ok) {
        const completion = await res.json();
        setGroups(prev => prev.map(g => ({
          ...g,
          tasks: g.tasks.map(t =>
            t.id === taskId ? { ...t, completion } : t
          ),
        })));
        fetchScore(viewDate);
      }
    } catch (err) {
      console.error("Failed to toggle highlight:", err);
    } finally {
      setActionLoading(prev => ({ ...prev, [taskId]: false }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewDate, groups]);

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
    }).then(() => refreshView()).finally(() => setActionLoading(prev => ({ ...prev, [task.id]: false })));
  };

  const handleDelete = async (id: number) => {
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      setGroups(prev => prev.map(g => ({
        ...g, tasks: g.tasks.filter(t => t.id !== id)
      })).filter(g => g.tasks.length > 0));
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      await refreshView();
    } catch (error) {
      console.error("Failed to delete task:", error);
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleDiscard = async (task: Task) => {
    setOpenMenuId(null);
    const isSkipped = task.completion?.skipped || false;
    setActionLoading(prev => ({ ...prev, [task.id]: true }));
    try {
      const res = await fetch('/api/tasks/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id, skipped: !isSkipped }),
      });
      if (res.ok) {
        const completion = await res.json();
        setGroups(prev => prev.map(g => ({
          ...g,
          tasks: g.tasks.map(t =>
            t.id === task.id ? { ...t, completion } : t
          ),
        })));
      }
      await fetchScore(viewDate);
    } catch (error) {
      console.error("Failed to skip task:", error);
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
      await refreshView();
    } catch (error) {
      console.error("Failed to move task:", error);
    } finally {
      setActionLoading(prev => ({ ...prev, [task.id]: false }));
    }
  };

  // --- Filter helpers ---
  const getEndOfWeek = useCallback(() => {
    const d = new Date(today + 'T12:00:00');
    const dayOfWeek = d.getDay();
    const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 5 + 7 - dayOfWeek;
    d.setDate(d.getDate() + daysUntilFriday);
    return d.toISOString().split('T')[0];
  }, [today]);

  const getTomorrow = useCallback(() => {
    const d = new Date(today + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, [today]);

  const getTaskDate = useCallback((bucket: string): string | null => {
    if (bucket === 'Today') return today;
    if (bucket === 'Tomorrow') return getTomorrow();
    if (bucket === 'No Date' || bucket === 'Later') return null;
    return bucket;
  }, [today, getTomorrow]);

  const getEndOfMonth = useCallback(() => {
    const d = new Date(today + 'T12:00:00');
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return lastDay.toISOString().split('T')[0];
  }, [today]);

  const isTaskInDateRange = useCallback((task: Task): boolean => {
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
          if (task.frequency === 'adhoc') {
            return task.startDate ? task.startDate >= today && task.startDate <= monthEnd : false;
          }
          const d = new Date(today + 'T12:00:00');
          d.setDate(d.getDate() + 7);
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
  }, [today, filters.date, getEndOfWeek, getTomorrow, getTaskDate, getEndOfMonth]);

  const passesStatusFilter = useCallback((completed: boolean, _value: number | null, skipped?: boolean) => {
    if (filters.status === 'all') return true;
    if (filters.status === 'discarded') return skipped === true;
    if (filters.status === 'done') return completed && !skipped;
    if (filters.status === 'todo') return !completed && !skipped;
    return true;
  }, [filters.status]);

  const getScheduleLabel = (task: Task) => {
    if (task.frequency === 'daily') return 'Every day';
    if (task.frequency === 'weekly') return 'Every Monday';
    if (task.frequency === 'custom' && task.customDays) {
      try {
        const days: number[] = JSON.parse(task.customDays);
        const label = formatScheduleLabel(days);
        const interval = task.repeatInterval && task.repeatInterval > 7 ? Math.round(task.repeatInterval / 7) : 1;
        return interval > 1 ? `${label} (every ${interval} weeks)` : label;
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

  return {
    // Auth & routing
    status,
    router,
    dateFormat,
    // Data
    groups,
    pillars,
    goalsList,
    cycles,
    loading,
    refreshing,
    noDateTasks,
    pastDays,
    // Filters
    filters,
    setFilters,
    activePopover,
    setActivePopover,
    datePickerMode,
    setDatePickerMode,
    pendingRange,
    setPendingRange,
    scoreSummary,
    // Timers & pending
    timers,
    pendingValues,
    setPendingValues,
    // Menu
    openMenuId,
    setOpenMenuId,
    actionLoading,
    authSnackbar,
    setAuthSnackbar,
    menuRef,
    // Computed
    today,
    getDateLabel,
    closePopover,
    // Handlers
    handleCheckboxToggle,
    handleCountChange,
    handleNumericSubmit,
    handleTimerToggle,
    handleDurationManualSubmit,
    handleHighlightToggle,
    handleCopy,
    handleDelete,
    handleDiscard,
    handleMoveDate,
    handleMarkDone,
    // Helpers
    formatTime,
    getDateBucket: (task: Task) => getDateBucket(task, today),
    isTaskInDateRange,
    passesStatusFilter,
    getScheduleLabel,
  };
}
