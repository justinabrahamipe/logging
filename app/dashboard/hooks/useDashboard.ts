"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "@/components/ThemeProvider";
import { DEMO_DASHBOARD } from "@/lib/demo-data";
import type {
  DailyScoreData,
  MomentumData,
  HistoryData,
  OutcomeData,
} from "@/lib/types";

export function useDashboard() {
  const { data: session, status } = useSession();
  const { dateFormat } = useTheme();
  const [score, setScore] = useState<DailyScoreData | null>(null);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [outcomesData, setOutcomesData] = useState<OutcomeData[]>([]);
  const [completionDates, setCompletionDates] = useState<Record<number, string[]>>({});
  const [momentumData, setMomentumData] = useState<MomentumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [todayTaskCount, setTodayTaskCount] = useState(0);
  const [seeding, setSeeding] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const seedingRef = useRef(false);

  const today = new Date().toISOString().split("T")[0];

  const currentStreak = useMemo(() => {
    if (!history?.scores?.length) return 0;
    const scoreMap = new Map<string, boolean>();
    for (const s of history.scores) {
      scoreMap.set(s.date, s.isPassing);
    }
    let streak = 0;
    const d = new Date();
    d.setDate(d.getDate() - 1);
    while (true) {
      const dateStr = d.toISOString().split("T")[0];
      const passing = scoreMap.get(dateStr);
      if (passing === true) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }, [history]);

  useEffect(() => {
    if (status === "unauthenticated") {
      setScore(DEMO_DASHBOARD.score as DailyScoreData);
      setHistory(DEMO_DASHBOARD.history as HistoryData);
      setMomentumData(DEMO_DASHBOARD.momentum as MomentumData);
      setTodayTaskCount(DEMO_DASHBOARD.todayTaskCount);
      setLoading(false);
      return;
    }
    if (session?.user?.id) {
      fetchData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status]);

  const fetchData = async () => {
    try {
      const [scoreRes, historyRes, outcomesRes, tasksRes, momentumRes, completionsRes] = await Promise.all([
        fetch(`/api/daily-score?date=${today}`),
        fetch("/api/daily-score/history?days=90"),
        fetch("/api/outcomes"),
        fetch(`/api/tasks?date=${today}`),
        fetch("/api/momentum"),
        fetch("/api/outcomes/completions"),
      ]);

      let scoreData = null;
      if (scoreRes.ok) {
        scoreData = await scoreRes.json();
        setScore(scoreData);
      }
      if (historyRes.ok) {
        setHistory(await historyRes.json());
      }
      if (outcomesRes.ok) {
        setOutcomesData(await outcomesRes.json());
      }
      if (completionsRes.ok) {
        setCompletionDates(await completionsRes.json());
      }
      if (momentumRes.ok) {
        setMomentumData(await momentumRes.json());
      }
      if (tasksRes.ok) {
        const groups = await tasksRes.json();
        const allTasks = groups.flatMap((g: { tasks: { completion?: { completed?: boolean } | null }[] }) => g.tasks);
        const count = allTasks.length;
        const completed = allTasks.filter((t: { completion?: { completed?: boolean } | null }) => t.completion?.completed).length;
        setTodayTaskCount(count);
        // Override score task counts with actual tasks from the tasks API
        if (scoreData) {
          scoreData.totalTasks = count;
          scoreData.completedTasks = completed;
          setScore({ ...scoreData });
        }
      }

      const skipSeed = sessionStorage.getItem('skip-auto-seed');
      if (scoreData && scoreData.totalTasks === 0 && !seedingRef.current && !skipSeed) {
        seedingRef.current = true;
        setSeeding(true);
        const seedRes = await fetch("/api/seed", { method: "POST" });
        if (seedRes.ok) {
          setShowWelcome(true);
          const [sr, hr, tr] = await Promise.all([
            fetch(`/api/daily-score?date=${today}`),
            fetch("/api/daily-score/history?days=90"),
            fetch(`/api/tasks?date=${today}`),
          ]);
          if (sr.ok) setScore(await sr.json());
          if (hr.ok) setHistory(await hr.json());
          if (tr.ok) {
            const groups = await tr.json();
            setTodayTaskCount(groups.reduce((sum: number, g: { tasks: unknown[] }) => sum + g.tasks.length, 0));
          }
        }
        setSeeding(false);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  return {
    score,
    history,
    outcomesData,
    completionDates,
    momentumData,
    loading,
    todayTaskCount,
    seeding,
    showWelcome,
    setShowWelcome,
    today,
    currentStreak,
    dateFormat,
  };
}
