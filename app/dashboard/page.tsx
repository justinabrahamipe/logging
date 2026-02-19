"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { FaFire, FaStar, FaTrophy, FaBolt, FaTimes, FaChartLine, FaArrowUp, FaArrowDown, FaSun } from "react-icons/fa";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from "recharts";

interface PillarScore {
  id: number;
  name: string;
  emoji: string;
  color: string;
  weight: number;
  score: number;
}

interface DailyScoreData {
  date: string;
  actionScore: number;
  scoreTier: string;
  pillarScores: PillarScore[];
  totalTasks: number;
  completedTasks: number;
}

interface UserStatsData {
  totalXp: number;
  level: number;
  levelTitle: string;
  currentStreak: number;
  bestStreak: number;
  levelInfo: {
    level: number;
    title: string;
    currentXp: number;
    xpForNextLevel: number;
    xpProgress: number;
  };
}

interface HistoryScore {
  date: string;
  actionScore: number;
  isPassing: boolean;
  pillarScores: Record<string, number>;
}

interface PillarMeta {
  id: number;
  name: string;
  emoji: string;
  color: string;
  weight: number;
}

interface HistoryData {
  scores: HistoryScore[];
  pillars: PillarMeta[];
}

interface OutcomeData {
  id: number;
  name: string;
  startValue: number;
  targetValue: number;
  currentValue: number;
  unit: string;
  direction: string;
  pillarColor: string | null;
}

function getTierColor(tier: string): string {
  switch (tier) {
    case "LEGENDARY":
      return "#FFD700";
    case "Excellent":
      return "#22C55E";
    case "Good":
      return "#3B82F6";
    case "Decent":
      return "#F59E0B";
    case "Needs Work":
      return "#F97316";
    case "Poor":
      return "#EF4444";
    default:
      return "#6B7280";
  }
}

function getHeatmapColor(score: number | null): string {
  if (score === null) return "bg-gray-200 dark:bg-gray-700";
  if (score >= 70) return "bg-green-500";
  if (score >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

function getHeatmapOpacity(score: number | null): string {
  if (score === null) return "opacity-40";
  if (score >= 90) return "opacity-100";
  if (score >= 70) return "opacity-80";
  if (score >= 50) return "opacity-70";
  return "opacity-80";
}

// --- Calendar Heatmap ---
function CalendarHeatmap({ scores }: { scores: HistoryScore[] }) {
  const [tooltip, setTooltip] = useState<{
    date: string;
    score: number | null;
    x: number;
    y: number;
  } | null>(null);

  const { weeks } = useMemo(() => {
    const scoreMap = new Map<string, number>();
    for (const s of scores) {
      scoreMap.set(s.date, s.actionScore);
    }

    const today = new Date();
    const daysArray: { date: string; score: number | null; dayOfWeek: number }[] = [];

    for (let i = 89; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      daysArray.push({
        date: dateStr,
        score: scoreMap.get(dateStr) ?? null,
        dayOfWeek: d.getDay(),
      });
    }

    // Group into weeks (columns)
    const weeksArray: typeof daysArray[] = [];
    let currentWeek: typeof daysArray = [];

    // Pad the first week with empty slots
    if (daysArray.length > 0) {
      const firstDow = daysArray[0].dayOfWeek;
      // Monday = 0 position. Convert Sunday(0)->6, Mon(1)->0, etc.
      const mondayOffset = firstDow === 0 ? 6 : firstDow - 1;
      for (let i = 0; i < mondayOffset; i++) {
        currentWeek.push({ date: "", score: null, dayOfWeek: -1 });
      }
    }

    for (const day of daysArray) {
      const mondayDow = day.dayOfWeek === 0 ? 6 : day.dayOfWeek - 1;
      if (mondayDow === 0 && currentWeek.length > 0) {
        weeksArray.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(day);
    }
    if (currentWeek.length > 0) weeksArray.push(currentWeek);

    return { days: daysArray, weeks: weeksArray };
  }, [scores]);

  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Last 90 Days
      </h2>
      <div className="relative overflow-x-auto">
        <div className="flex gap-0.5">
          {/* Day labels column */}
          <div className="flex flex-col gap-0.5 mr-1">
            {dayLabels.map((label, i) => (
              <div
                key={i}
                className="w-4 h-4 text-[10px] text-gray-400 dark:text-gray-500 flex items-center justify-center"
              >
                {i % 2 === 0 ? label : ""}
              </div>
            ))}
          </div>
          {/* Weeks */}
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {week.map((day, di) => (
                <div
                  key={di}
                  className={`w-4 h-4 rounded-sm cursor-pointer transition-all ${
                    day.date
                      ? `${getHeatmapColor(day.score)} ${getHeatmapOpacity(day.score)}`
                      : "bg-transparent"
                  }`}
                  onMouseEnter={(e) => {
                    if (day.date) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltip({
                        date: day.date,
                        score: day.score,
                        x: rect.left,
                        y: rect.top - 40,
                      });
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-3 text-xs text-gray-500 dark:text-gray-400">
          <span>Less</span>
          <div className="w-3 h-3 rounded-sm bg-gray-200 dark:bg-gray-700 opacity-40" />
          <div className="w-3 h-3 rounded-sm bg-red-500 opacity-80" />
          <div className="w-3 h-3 rounded-sm bg-yellow-500 opacity-70" />
          <div className="w-3 h-3 rounded-sm bg-green-500 opacity-80" />
          <div className="w-3 h-3 rounded-sm bg-green-500 opacity-100" />
          <span>More</span>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-2 py-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded shadow-lg pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.date}: {tooltip.score !== null ? `${tooltip.score}%` : "No data"}
        </div>
      )}
    </div>
  );
}

// --- Score Trend Line Chart ---
function ScoreTrendChart({ scores }: { scores: HistoryScore[] }) {
  const data = useMemo(() => {
    return [...scores]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => ({
        date: s.date.slice(5), // MM-DD
        fullDate: s.date,
        score: s.actionScore,
      }));
  }, [scores]);

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Score Trend
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-8">
          No score data yet. Complete some tasks to see your trend!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Score Trend (Last 30 Days)
      </h2>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#9CA3AF" }}
            tickLine={false}
            axisLine={{ stroke: "#374151" }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "#9CA3AF" }}
            tickLine={false}
            axisLine={{ stroke: "#374151" }}
          />
          <RechartsTooltip
            contentStyle={{
              backgroundColor: "var(--tooltip-bg, #1F2937)",
              border: "1px solid #374151",
              borderRadius: "8px",
              color: "var(--tooltip-text, #F9FAFB)",
              fontSize: 12,
            }}
            formatter={(value: number | undefined) => [`${value ?? 0}%`, "Score"]}
            labelFormatter={(label: unknown) => `Date: ${label}`}
          />
          <ReferenceLine
            y={70}
            stroke="#22C55E"
            strokeDasharray="5 5"
            strokeOpacity={0.6}
            label={{
              value: "Pass",
              position: "right",
              fill: "#22C55E",
              fontSize: 11,
            }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#8B5CF6"
            strokeWidth={2}
            dot={{ fill: "#8B5CF6", r: 3 }}
            activeDot={{ r: 5, fill: "#A78BFA" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// --- Pillar Breakdown Bar Chart ---
function PillarBreakdownChart({
  scores,
  pillarsMeta,
}: {
  scores: HistoryScore[];
  pillarsMeta: PillarMeta[];
}) {
  const data = useMemo(() => {
    if (scores.length === 0 || pillarsMeta.length === 0) return [];

    const totals: Record<number, { sum: number; count: number }> = {};
    for (const s of scores) {
      for (const [pidStr, score] of Object.entries(s.pillarScores)) {
        const pid = Number(pidStr);
        if (!totals[pid]) totals[pid] = { sum: 0, count: 0 };
        totals[pid].sum += score;
        totals[pid].count += 1;
      }
    }

    return pillarsMeta
      .filter((p) => totals[p.id])
      .map((p) => ({
        name: `${p.emoji} ${p.name}`,
        avg: Math.round(totals[p.id].sum / totals[p.id].count),
        color: p.color,
      }));
  }, [scores, pillarsMeta]);

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Pillar Averages
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-8">
          No pillar data yet.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Pillar Averages
      </h2>
      <ResponsiveContainer width="100%" height={data.length * 50 + 20}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
        >
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "#9CA3AF" }}
            tickLine={false}
            axisLine={{ stroke: "#374151" }}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 12, fill: "#9CA3AF" }}
            tickLine={false}
            axisLine={false}
            width={120}
          />
          <RechartsTooltip
            contentStyle={{
              backgroundColor: "var(--tooltip-bg, #1F2937)",
              border: "1px solid #374151",
              borderRadius: "8px",
              color: "var(--tooltip-text, #F9FAFB)",
              fontSize: 12,
            }}
            formatter={(value: number | undefined) => [`${value ?? 0}%`, "Average"]}
          />
          <Bar dataKey="avg" radius={[0, 6, 6, 0]} barSize={24}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// --- Streak Flame Chain ---
function StreakFlameChain({
  scores,
  currentStreak,
}: {
  scores: HistoryScore[];
  currentStreak: number;
}) {
  const days = useMemo(() => {
    const scoreMap = new Map<string, boolean>();
    for (const s of scores) {
      scoreMap.set(s.date, s.isPassing);
    }

    const today = new Date();
    const result: { date: string; label: string; status: "pass" | "fail" | "none" }[] = [];

    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const passing = scoreMap.get(dateStr);

      result.push({
        date: dateStr,
        label: d.toLocaleDateString("en-US", { weekday: "narrow" }),
        status: passing === undefined ? "none" : passing ? "pass" : "fail",
      });
    }

    return result;
  }, [scores]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Streak Chain
        </h2>
        <div className="flex items-center gap-2">
          <FaFire className="text-orange-500 text-lg" />
          <span className="text-2xl font-bold text-orange-500">{currentStreak}</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {currentStreak === 1 ? "day" : "days"}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-0.5 md:gap-1 overflow-x-auto">
        {days.map((day, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5 md:gap-1 min-w-0 shrink-0">
            <span className="text-[9px] md:text-[10px] text-gray-400 dark:text-gray-500">
              {day.label}
            </span>
            <div
              className={`w-5 h-5 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[10px] md:text-sm ${
                day.status === "pass"
                  ? "bg-orange-500/20 text-orange-500"
                  : day.status === "fail"
                  ? "bg-red-500/20 text-red-400"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
              }`}
            >
              {day.status === "pass" ? (
                <FaFire />
              ) : day.status === "fail" ? (
                <FaTimes className="text-[8px] md:text-xs" />
              ) : (
                <span className="text-[8px] md:text-xs">-</span>
              )}
            </div>
            <span className="text-[8px] md:text-[9px] text-gray-400 dark:text-gray-500">
              {day.date.slice(8)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Main Dashboard ---
export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [score, setScore] = useState<DailyScoreData | null>(null);
  const [stats, setStats] = useState<UserStatsData | null>(null);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [outcomesData, setOutcomesData] = useState<OutcomeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayTaskCount, setTodayTaskCount] = useState(0);
  const [seeding, setSeeding] = useState(false);
  const seedingRef = useRef(false);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (session?.user?.id) {
      fetchData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status]);

  const fetchData = async () => {
    try {
      const [scoreRes, statsRes, historyRes, outcomesRes, tasksRes] = await Promise.all([
        fetch(`/api/daily-score?date=${today}`),
        fetch("/api/user-stats"),
        fetch("/api/daily-score/history?days=90"),
        fetch("/api/outcomes"),
        fetch(`/api/tasks?date=${today}`),
      ]);

      if (scoreRes.ok) {
        setScore(await scoreRes.json());
      }
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
      if (historyRes.ok) {
        setHistory(await historyRes.json());
      }
      if (outcomesRes.ok) {
        setOutcomesData(await outcomesRes.json());
      }
      if (tasksRes.ok) {
        const groups = await tasksRes.json();
        const count = groups.reduce((sum: number, g: { tasks: unknown[] }) => sum + g.tasks.length, 0);
        setTodayTaskCount(count);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    if (seedingRef.current) return;
    seedingRef.current = true;
    setSeeding(true);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      if (res.ok) {
        const [scoreRes, statsRes, historyRes] = await Promise.all([
          fetch(`/api/daily-score?date=${today}`),
          fetch("/api/user-stats"),
          fetch("/api/daily-score/history?days=90"),
        ]);
        if (scoreRes.ok) setScore(await scoreRes.json());
        if (statsRes.ok) setStats(await statsRes.json());
        if (historyRes.ok) setHistory(await historyRes.json());
      }
    } catch (error) {
      console.error("Failed to seed:", error);
    } finally {
      setSeeding(false);
    }
  };

  // Filter scores for 30 days for the line chart
  const last30Scores = useMemo(() => {
    if (!history?.scores) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().split("T")[0];
    return history.scores.filter((s) => s.date >= cutoffStr);
  }, [history]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
              Dashboard
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <Link href="/tasks">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium"
            >
              Go to Tasks
            </motion.button>
          </Link>
        </div>

        {/* Morning Briefing */}
        {stats && history && (
          (() => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split("T")[0];
            const yesterdayScore = history.scores.find(s => s.date === yesterdayStr);

            const getStreakMessage = (streak: number) => {
              if (streak >= 30) return "Unstoppable. Keep dominating.";
              if (streak >= 14) return "Two weeks strong. You're building something real.";
              if (streak >= 7) return "A full week! Momentum is on your side.";
              if (streak >= 3) return "Nice streak going. Don't break the chain.";
              if (streak >= 1) return "Good start. Let's keep it going today.";
              return "New day, fresh start. Let's make it count.";
            };

            return (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <FaSun className="text-2xl text-amber-500" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Today&apos;s Briefing
                  </h2>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  {/* Yesterday's Score */}
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {yesterdayScore ? `${yesterdayScore.actionScore}%` : "—"}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Yesterday
                    </div>
                  </div>

                  {/* Current Streak */}
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-500">
                      {stats.currentStreak}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Day Streak
                    </div>
                  </div>

                  {/* Tasks Due */}
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-500">
                      {todayTaskCount}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Tasks Today
                    </div>
                  </div>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 text-center italic">
                  {getStreakMessage(stats.currentStreak)}
                </p>
              </div>
            );
          })()
        )}

        {/* Empty State — Seed Prompt */}
        {score && score.totalTasks === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 mb-6 text-center">
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
              No pillars or tasks yet. Set up your default data to get started.
            </p>
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {seeding ? "Setting up..." : "Load Default Data"}
            </button>
          </div>
        )}

        {/* Action Score */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FaBolt className="text-2xl text-yellow-500" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Action Score
              </h2>
            </div>
            {score && (
              <span
                className="px-3 py-1 rounded-full text-sm font-bold"
                style={{
                  backgroundColor: getTierColor(score.scoreTier) + "20",
                  color: getTierColor(score.scoreTier),
                }}
              >
                {score.scoreTier}
              </span>
            )}
          </div>

          {score && (
            <>
              <div className="relative w-full h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(score.actionScore, 100)}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: getTierColor(score.scoreTier) }}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {score.completedTasks}/{score.totalTasks} tasks
                </span>
                <span className="font-bold text-gray-900 dark:text-white text-lg">
                  {score.actionScore}%
                </span>
              </div>
            </>
          )}
        </div>

        {/* Progress Score */}
        {outcomesData.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FaChartLine className="text-2xl text-emerald-500" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Progress Score
                </h2>
              </div>
              <Link href="/outcomes">
                <span className="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400">View All</span>
              </Link>
            </div>

            {(() => {
              const totalProgress = outcomesData.reduce((sum, o) => {
                const range = Math.abs(o.targetValue - o.startValue);
                if (range === 0) return sum + 100;
                const p = Math.abs(o.currentValue - o.startValue) / range * 100;
                return sum + Math.max(0, Math.min(p, 100));
              }, 0);
              const progressScore = Math.round(totalProgress / outcomesData.length);

              return (
                <>
                  <div className="relative w-full h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(progressScore, 100)}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                    />
                  </div>
                  <div className="flex justify-between text-sm mb-4">
                    <span className="text-gray-600 dark:text-gray-400">
                      {outcomesData.length} outcome{outcomesData.length !== 1 ? "s" : ""}
                    </span>
                    <span className="font-bold text-gray-900 dark:text-white text-lg">
                      {progressScore}%
                    </span>
                  </div>

                  <div className="space-y-3">
                    {outcomesData.map((outcome) => {
                      const range = Math.abs(outcome.targetValue - outcome.startValue);
                      const progress = range === 0 ? 100 : Math.max(0, Math.min(
                        Math.abs(outcome.currentValue - outcome.startValue) / range * 100, 100
                      ));
                      const color = outcome.pillarColor || "#10B981";

                      return (
                        <div key={outcome.id}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              {outcome.direction === "decrease" ? (
                                <FaArrowDown className="text-xs text-green-500" />
                              ) : (
                                <FaArrowUp className="text-xs text-green-500" />
                              )}
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {outcome.name}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {outcome.currentValue} / {outcome.targetValue} {outcome.unit}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(progress, 100)}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Pillar Breakdown (today) */}
        {score && score.pillarScores.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Pillar Breakdown
            </h2>
            <div className="space-y-4">
              {score.pillarScores.map((pillar) => (
                <div key={pillar.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span>{pillar.emoji}</span>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {pillar.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({pillar.weight}%)
                      </span>
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {pillar.score}%
                    </span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(pillar.score, 100)}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: pillar.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* XP & Level + Streak */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* XP & Level */}
          {stats && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-2 mb-4">
                <FaTrophy className="text-2xl text-purple-500" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Level
                </h2>
              </div>
              <div className="text-center mb-4">
                <div className="text-4xl font-bold text-purple-600 dark:text-purple-400">
                  {stats.levelInfo.level}
                </div>
                <div className="text-lg text-gray-600 dark:text-gray-400">
                  {stats.levelInfo.title}
                </div>
              </div>
              <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.levelInfo.xpProgress}%` }}
                  transition={{ duration: 0.8 }}
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                />
              </div>
              <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                {stats.levelInfo.currentXp} / {stats.levelInfo.xpForNextLevel} XP
                to next level
              </p>
            </div>
          )}

          {/* Streak */}
          {stats && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-2 mb-4">
                <FaFire className="text-2xl text-orange-500" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Streak
                </h2>
              </div>
              <div className="text-center">
                <div className="text-5xl font-bold text-orange-500 mb-2">
                  {stats.currentStreak}
                </div>
                <div className="text-lg text-gray-600 dark:text-gray-400">
                  {stats.currentStreak === 1 ? "day" : "days"} in a row
                </div>
                <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                  <FaStar className="inline mr-1 text-yellow-500" />
                  Best: {stats.bestStreak} days
                </div>
              </div>
            </div>
          )}
        </div>

        {/* === Phase 3: Visualizations === */}

        {/* Streak Flame Chain */}
        {history && stats && (
          <StreakFlameChain
            scores={history.scores}
            currentStreak={stats.currentStreak}
          />
        )}

        {/* Calendar Heatmap */}
        {history && <CalendarHeatmap scores={history.scores} />}

        {/* Score Trend Line Chart */}
        {history && <ScoreTrendChart scores={last30Scores} />}

        {/* Pillar Breakdown Bar Chart */}
        {history && (
          <PillarBreakdownChart
            scores={last30Scores}
            pillarsMeta={history.pillars}
          />
        )}
      </motion.div>
    </div>
  );
}
