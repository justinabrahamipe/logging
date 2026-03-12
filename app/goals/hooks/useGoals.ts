"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Outcome, Pillar, LinkedTask, LogEntry, CycleOption } from "../types";
import { DEMO_OUTCOMES, DEMO_PILLARS } from "@/lib/demo-data";

export function useGoals() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [allOutcomes, setAllOutcomes] = useState<Outcome[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [logsMap, setLogsMap] = useState<Record<number, LogEntry[]>>({});
  const [goalTab, setGoalTab] = useState<"all" | "habitual" | "target" | "outcome">("all");
  const [timeTab, setTimeTab] = useState<"current" | "future" | "past">("current");
  const [linkedTasks, setLinkedTasks] = useState<LinkedTask[]>([]);
  const [taskCompletionDates, setTaskCompletionDates] = useState<Record<number, string[]>>({});
  const [cycles, setCycles] = useState<CycleOption[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      // Load demo data for non-logged-in users
      setAllOutcomes(DEMO_OUTCOMES.map(o => ({
        ...o,
        periodId: null,
        logFrequency: "daily",
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
      fetchOutcomes();
      fetchPillars();
      fetchLinkedTasks();
      fetchCycles();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status]);

  const fetchOutcomes = async () => {
    try {
      const res = await fetch("/api/outcomes");
      if (res.ok) {
        const data = await res.json();
        setAllOutcomes(data);
        setGoalTab("all");
        await fetchAllLogs(data);
      }
    } catch (error) {
      console.error("Failed to fetch outcomes:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllLogs = async (outcomesList: Outcome[]) => {
    const entries: Record<number, LogEntry[]> = {};
    await Promise.all(
      outcomesList.map(async (o) => {
        try {
          const res = await fetch(`/api/outcomes/${o.id}/log`);
          if (res.ok) entries[o.id] = await res.json();
        } catch {
          // ignore individual failures
        }
      })
    );
    setLogsMap(entries);
  };

  const fetchPillars = async () => {
    try {
      const res = await fetch("/api/pillars");
      if (res.ok) setPillars(await res.json());
    } catch (error) {
      console.error("Failed to fetch pillars:", error);
    }
  };

  const fetchLinkedTasks = async () => {
    try {
      const [tasksRes, completionsRes] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/outcomes/completions'),
      ]);
      if (tasksRes.ok) {
        const groups = await tasksRes.json();
        const allTasks: LinkedTask[] = [];
        for (const group of groups) {
          for (const task of group.tasks) {
            if (task.outcomeId) {
              allTasks.push({ id: task.id, name: task.name, outcomeId: task.outcomeId });
            }
          }
        }
        setLinkedTasks(allTasks);
      }
      if (completionsRes.ok) {
        setTaskCompletionDates(await completionsRes.json());
      }
    } catch (error) {
      console.error("Failed to fetch linked tasks:", error);
    }
  };

  const fetchCycles = async () => {
    try {
      const res = await fetch("/api/cycles");
      if (res.ok) setCycles(await res.json());
    } catch (error) {
      console.error("Failed to fetch cycles:", error);
    }
  };

  const handleArchive = async (id: number) => {
    try {
      await fetch(`/api/outcomes/${id}`, { method: "DELETE" });
      await fetchOutcomes();
    } catch (error) {
      console.error("Failed to archive outcome:", error);
    }
    setMenuOpen(null);
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
          outcomeId: outcome.id,
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
    const range = Math.abs(outcome.targetValue - outcome.startValue);
    if (range === 0) return 100;
    const progress = Math.abs(outcome.currentValue - outcome.startValue) / range * 100;
    return Math.max(0, Math.min(progress, 100));
  };

  const today = new Date().toISOString().split("T")[0];

  const getTimeCategory = (o: Outcome): "current" | "future" | "past" => {
    if (o.targetDate && o.targetDate < today) return "past";
    if (o.startDate && o.startDate > today) return "future";
    return "current";
  };

  const filteredOutcomes = useMemo(() => {
    return allOutcomes
      .filter((o) => {
        if (goalTab === "all") return true;
        const type = o.goalType === "effort" ? "target" : (o.goalType || "outcome");
        return type === goalTab;
      })
      .filter((o) => getTimeCategory(o) === timeTab);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allOutcomes, goalTab, timeTab]);

  const timeCounts = useMemo(() => {
    const counts = { current: 0, future: 0, past: 0 };
    for (const o of allOutcomes.filter((o) => {
      if (goalTab === "all") return true;
      const type = o.goalType === "effort" ? "target" : (o.goalType || "outcome");
      return type === goalTab;
    })) {
      counts[getTimeCategory(o)]++;
    }
    return counts;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allOutcomes, goalTab]);

  return {
    allOutcomes,
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
    filteredOutcomes,
    timeCounts,
    today,
    handleArchive,
    handleAddTaskForToday,
    getProgress,
    fetchOutcomes,
    fetchLinkedTasks,
  };
}
