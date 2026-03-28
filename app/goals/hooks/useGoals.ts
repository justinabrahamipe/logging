"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Outcome, Pillar, LinkedTask, LogEntry, CycleOption } from "../types";
import { DEMO_OUTCOMES, DEMO_PILLARS } from "@/lib/demo-data";

export function useGoals() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [allGoals, setAllGoals] = useState<Outcome[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [logsMap, setLogsMap] = useState<Record<number, LogEntry[]>>({});
  const [goalTab, setGoalTabState] = useState<"all" | "habitual" | "target" | "outcome">(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('goalsGoalTab');
      if (saved === 'all' || saved === 'habitual' || saved === 'target' || saved === 'outcome') return saved;
    }
    return "all";
  });
  const setGoalTab = (v: "all" | "habitual" | "target" | "outcome") => { setGoalTabState(v); localStorage.setItem('goalsGoalTab', v); };
  const [timeTab, setTimeTabState] = useState<"current" | "future" | "past">(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('goalsTimeTab');
      if (saved === 'current' || saved === 'future' || saved === 'past') return saved;
    }
    return "current";
  });
  const setTimeTab = (v: "current" | "future" | "past") => { setTimeTabState(v); localStorage.setItem('goalsTimeTab', v); };
  const [linkedTasks, setLinkedTasks] = useState<LinkedTask[]>([]);
  const [taskCompletionDates, setTaskCompletionDates] = useState<Record<number, { date: string; value: number; completed: boolean }[]>>({});
  const [cycles, setCycles] = useState<CycleOption[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      // Load demo data for non-logged-in users
      setAllGoals(DEMO_OUTCOMES.map(o => ({
        ...o,
        periodId: null,
        scheduleDays: null,
        autoCreateTasks: false,
        pillarName: DEMO_PILLARS.find(p => p.id === o.pillarId)?.name || null,
        pillarColor: o.pillarColor,
        pillarEmoji: DEMO_PILLARS.find(p => p.id === o.pillarId)?.emoji || null,
      })) as Outcome[]);
      setPillars(DEMO_PILLARS.map(p => ({ id: p.id, name: p.name, emoji: p.emoji, color: p.color })));
      setGoalTab("all");
      setLoading(false);
      return;
    }
    if (session?.user?.id) {
      fetchAll();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status]);

  const fetchAll = async () => {
    try {
      const [outcomesRes, logsRes, pillarsRes, goalTasksRes, completionsRes, cyclesRes] = await Promise.all([
        fetch("/api/outcomes"),
        fetch("/api/outcomes/logs"),
        fetch("/api/pillars"),
        fetch("/api/outcomes/tasks"),
        fetch("/api/outcomes/completions"),
        fetch("/api/cycles"),
      ]);

      if (outcomesRes.ok) {
        const data = await outcomesRes.json();
        setAllGoals(data);
        setGoalTab("all");
      }
      if (logsRes.ok) {
        setLogsMap(await logsRes.json());
      }
      if (pillarsRes.ok) {
        setPillars(await pillarsRes.json());
      }
      if (goalTasksRes.ok) {
        const goalTasks = await goalTasksRes.json();
        const allTasks: LinkedTask[] = goalTasks.map((t: { id: number; name: string; goalId: number; completionType: string; basePoints: number; target: number | null; unit: string | null; date: string; completed: boolean; value: number | null }) => ({
          id: t.id, name: t.name, goalId: t.goalId, frequency: 'adhoc' as const, completionType: t.completionType, basePoints: t.basePoints, target: t.target, unit: t.unit, completed: t.completed, value: t.value, startDate: t.date,
        }));
        setLinkedTasks(allTasks);
      }
      if (completionsRes.ok) {
        setTaskCompletionDates(await completionsRes.json());
      }
      if (cyclesRes.ok) {
        setCycles(await cyclesRes.json());
      }
    } catch (error) {
      console.error("Failed to fetch goals data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGoals = async () => {
    try {
      const [outcomesRes, logsRes] = await Promise.all([
        fetch("/api/outcomes"),
        fetch("/api/outcomes/logs"),
      ]);
      if (outcomesRes.ok) {
        setAllGoals(await outcomesRes.json());
        setGoalTab("all");
      }
      if (logsRes.ok) {
        setLogsMap(await logsRes.json());
      }
    } catch (error) {
      console.error("Failed to fetch outcomes:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLinkedTasks = async () => {
    try {
      const [goalTasksRes, completionsRes] = await Promise.all([
        fetch('/api/outcomes/tasks'),
        fetch('/api/outcomes/completions'),
      ]);
      if (goalTasksRes.ok) {
        const goalTasks = await goalTasksRes.json();
        const allTasks: LinkedTask[] = goalTasks.map((t: { id: number; name: string; goalId: number; completionType: string; basePoints: number; target: number | null; unit: string | null; date: string; completed: boolean; value: number | null }) => ({
          id: t.id, name: t.name, goalId: t.goalId, frequency: 'adhoc' as const, completionType: t.completionType, basePoints: t.basePoints, target: t.target, unit: t.unit, completed: t.completed, value: t.value, startDate: t.date,
        }));
        setLinkedTasks(allTasks);
      }
      if (completionsRes.ok) {
        setTaskCompletionDates(await completionsRes.json());
      }
    } catch (error) {
      console.error("Failed to fetch linked tasks:", error);
    }
  };

  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const handleArchive = (id: number) => {
    setConfirmDialog({
      message: "Permanently delete this goal and all its data?",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await fetch(`/api/outcomes/${id}`, { method: "DELETE" });
          await fetchGoals();
        } catch (error) {
          console.error("Failed to delete outcome:", error);
        }
        setMenuOpen(null);
      },
    });
  };

  const handleStatusChange = (id: number, newStatus: 'active' | 'completed' | 'abandoned') => {
    const label = newStatus === 'completed' ? 'complete' : newStatus === 'abandoned' ? 'abandon' : 'reactivate';
    setConfirmDialog({
      message: `Are you sure you want to ${label} this goal?`,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await fetch(`/api/outcomes/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus }),
          });
          await fetchGoals();
        } catch (error) {
          console.error("Failed to update goal status:", error);
        }
        setMenuOpen(null);
      },
    });
  };

  const handleAddTaskForToday = async (outcome: Outcome): Promise<boolean> => {
    if (status !== "authenticated") return false;
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: outcome.name,
          pillarId: outcome.pillarId || null,
          completionType: outcome.completionType || 'checkbox',
          target: outcome.dailyTarget || null,
          unit: outcome.completionType === 'checkbox' ? null : (outcome.unit || null),
          frequency: 'adhoc',
          goalId: outcome.id,
          periodId: outcome.periodId || null,
          basePoints: 10,
        }),
      });
      if (res.ok) {
        const task = await res.json();
        // Auto-complete the task
        await fetch('/api/tasks/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId: task.id, date: today, completed: true, value: outcome.dailyTarget || 1 }),
        });
        await fetchLinkedTasks();
        return true;
      }
    } catch (error) {
      console.error("Failed to add task:", error);
    }
    return false;
  };

  const getProgress = (outcome: Outcome) => {
    const range = outcome.targetValue - outcome.startValue;
    if (range === 0) return 100;
    const progress = (outcome.currentValue - outcome.startValue) / range * 100;
    return Math.min(progress, 100);
  };

  const today = new Date().toISOString().split("T")[0];

  const getTimeCategory = (o: Outcome): "current" | "future" | "past" => {
    if (o.status === 'completed' || o.status === 'abandoned') return "past";
    if (o.targetDate && o.targetDate < today) return "past";
    if (o.startDate && o.startDate > today) return "future";
    return "current";
  };

  const filteredGoals = useMemo(() => {
    return allGoals
      .filter((o) => {
        if (goalTab === "all") return true;
        const type = o.goalType === "effort" ? "target" : (o.goalType || "outcome");
        return type === goalTab;
      })
      .filter((o) => getTimeCategory(o) === timeTab);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allGoals, goalTab, timeTab]);

  const timeCounts = useMemo(() => {
    const counts = { current: 0, future: 0, past: 0 };
    for (const o of allGoals.filter((o) => {
      if (goalTab === "all") return true;
      const type = o.goalType === "effort" ? "target" : (o.goalType || "outcome");
      return type === goalTab;
    })) {
      counts[getTimeCategory(o)]++;
    }
    return counts;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allGoals, goalTab]);

  return {
    allGoals,
    pillars,
    loading,
    menuOpen,
    setMenuOpen,
    logsMap,
    goalTab,
    setGoalTab,
    timeTab,
    setTimeTab,
    linkedTasks,
    taskCompletionDates,
    cycles,
    filteredGoals,
    timeCounts,
    today,
    handleArchive,
    handleStatusChange,
    handleAddTaskForToday,
    getProgress,
    fetchGoals,
    fetchLinkedTasks,
    confirmDialog,
    setConfirmDialog,
  };
}
