"use client";

import { useState, useEffect, useMemo } from "react";
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
  const { dateFormat, streakThreshold } = useTheme();
  const [score, setScore] = useState<DailyScoreData | null>(null);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [outcomesData, setOutcomesData] = useState<OutcomeData[]>([]);
  const [completionDates, setCompletionDates] = useState<Record<number, { date: string; value: number; completed: boolean }[]>>({});
  const [momentumData, setMomentumData] = useState<MomentumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [todayTaskCount, setTodayTaskCount] = useState(0);

  const today = new Date().toISOString().split("T")[0];

  const currentStreak = useMemo(() => {
    if (!history?.scores?.length) return 0;
    const scoreMap = new Map<string, number>();
    for (const s of history.scores) {
      scoreMap.set(s.date, s.actionScore);
    }
    let streak = 0;
    const d = new Date();
    d.setDate(d.getDate() - 1);
    while (true) {
      const dateStr = d.toISOString().split("T")[0];
      const score = scoreMap.get(dateStr);
      if (score !== undefined && score >= streakThreshold) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }, [history, streakThreshold]);

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
        const data = await tasksRes.json();
        const groups = Array.isArray(data) ? data : (data.groups || []);
        const count = groups.reduce((sum: number, g: { tasks: unknown[] }) => sum + g.tasks.length, 0);
        setTodayTaskCount(count);
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
    today,
    currentStreak,
    dateFormat,
  };
}
