"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

interface ScoreData {
  actionScore: number;
  scoreTier: string;
  completedTasks: number;
  totalTasks: number;
  momentumScore: number | null;
}

interface MomentumData {
  overall: number;
  trajectory: {
    overall: number;
  };
}

const TIER_COLORS: Record<string, string> = {
  LEGENDARY: "text-yellow-500",
  Excellent: "text-green-500",
  Good: "text-zinc-500",
  Decent: "text-amber-500",
  "Needs Work": "text-orange-500",
  Poor: "text-red-500",
};

export default function HighlightsBanner() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [today, setToday] = useState<ScoreData | null>(null);
  const [yesterday, setYesterday] = useState<ScoreData | null>(null);
  const [momentum, setMomentum] = useState<MomentumData | null>(null);

  const authPages = ["/login", "/verify-request", "/error", "/"];
  const isHidden = authPages.includes(pathname);

  useEffect(() => {
    if (!session?.user?.id || isHidden) return;

    const todayStr = new Date().toISOString().split("T")[0];
    const yDate = new Date();
    yDate.setDate(yDate.getDate() - 1);
    const yesterdayStr = yDate.toISOString().split("T")[0];

    fetch(`/api/daily-score?date=${todayStr}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setToday(data); })
      .catch(() => {});

    fetch(`/api/daily-score?date=${yesterdayStr}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setYesterday(data); })
      .catch(() => {});

    fetch("/api/momentum")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setMomentum(data); })
      .catch(() => {});
  }, [session?.user?.id, isHidden, pathname]);

  if (isHidden || !session?.user?.id || !today) return null;

  const todayColor = TIER_COLORS[today.scoreTier] || "text-zinc-500";
  const yesterdayColor = yesterday ? (TIER_COLORS[yesterday.scoreTier] || "text-zinc-500") : "";

  return (
    <div className="bg-zinc-50 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 py-1 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className="text-zinc-500 dark:text-zinc-400">Today</span>
          <span className={`font-bold ${todayColor}`}>
            {today.actionScore}%
          </span>
          <span className="text-zinc-400 dark:text-zinc-500">
            {today.completedTasks}/{today.totalTasks}
          </span>
          {yesterday && (
            <span className="hidden md:inline-flex items-center gap-1.5 border-l border-zinc-300 dark:border-zinc-700 pl-3">
              <span className="text-zinc-500 dark:text-zinc-400">Yesterday</span>
              <span className={`font-bold ${yesterdayColor}`}>
                {yesterday.actionScore}%
              </span>
              <span className="text-zinc-400 dark:text-zinc-500">
                {yesterday.completedTasks}/{yesterday.totalTasks}
              </span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {momentum && (
            <>
              <span className={`font-bold ${momentum.overall >= 1.0 ? "text-green-500" : "text-red-500"}`}>
                {momentum.overall.toFixed(1)}x
              </span>
              <span className="text-zinc-400 dark:text-zinc-500">Momentum</span>
              <span className="border-l border-zinc-300 dark:border-zinc-700 pl-3">
                <span className={`font-bold ${momentum.trajectory.overall >= 1.0 ? "text-green-500" : "text-red-500"}`}>
                  {momentum.trajectory.overall.toFixed(1)}x
                </span>
                <span className="text-zinc-400 dark:text-zinc-500 ml-1">Trajectory</span>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
