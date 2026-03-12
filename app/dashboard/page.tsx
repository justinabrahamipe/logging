"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { FaFire, FaStar, FaTrophy, FaBolt, FaTimes, FaChartLine, FaArrowUp, FaArrowDown, FaSun } from "react-icons/fa";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DEMO_DASHBOARD } from "@/lib/demo-data";
import { formatDate } from "@/lib/format";
import { useTheme } from "@/components/ThemeProvider";
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
  Legend,
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
  momentumScore: number | null;
  scoreTier: string;
  pillarScores: PillarScore[];
  totalTasks: number;
  completedTasks: number;
}

interface MomentumGoal {
  goalId: number;
  goalType: string;
  pillarId: number | null;
  momentum: number;
  bufferDays: number;
  label: string;
  name: string;
  currentValue: number;
  targetValue: number;
  unit: string;
}

interface MomentumPillar {
  id: number;
  name: string;
  emoji: string;
  color: string;
  weight: number;
  momentum: number | null;
}

interface TrajectoryGoal {
  goalId: number;
  pillarId: number | null;
  trajectory: number;
  label: string;
  name: string;
  currentValue: number;
  targetValue: number;
  unit: string;
}

interface MomentumData {
  overall: number;
  pillars: MomentumPillar[];
  goals: MomentumGoal[];
  trajectory: {
    overall: number;
    goals: TrajectoryGoal[];
  };
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
  momentumScore: number | null;
  isPassing: boolean;
  pillarScores: Record<string, number>;
  pillarMomentum: Record<string, number>;
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
  pillarEmoji: string | null;
  goalType: string;
  scheduleDays: string | null;
  startDate: string | null;
  targetDate: string | null;
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
  if (score === null) return "bg-zinc-200 dark:bg-zinc-700";
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
  const [preset, setPreset] = useState("quarter");
  const [startDate, setStartDate] = useState(() => getPresetDates("quarter").start);
  const [endDate, setEndDate] = useState(() => getPresetDates("quarter").end);
  const [tooltip, setTooltip] = useState<{
    date: string;
    score: number | null;
    x: number;
    y: number;
  } | null>(null);

  const handlePreset = (p: string) => {
    setPreset(p);
    if (p !== "custom") {
      const { start, end } = getPresetDates(p);
      setStartDate(start);
      setEndDate(end);
    }
  };

  const { weeks } = useMemo(() => {
    const scoreMap = new Map<string, number>();
    for (const s of scores) {
      scoreMap.set(s.date, s.actionScore);
    }

    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    const daysArray: { date: string; score: number | null; dayOfWeek: number }[] = [];

    const d = new Date(start);
    while (d <= end) {
      const dateStr = d.toISOString().split("T")[0];
      daysArray.push({
        date: dateStr,
        score: scoreMap.get(dateStr) ?? null,
        dayOfWeek: d.getDay(),
      });
      d.setDate(d.getDate() + 1);
    }

    const weeksArray: typeof daysArray[] = [];
    let currentWeek: typeof daysArray = [];

    if (daysArray.length > 0) {
      const firstDow = daysArray[0].dayOfWeek;
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
  }, [scores, startDate, endDate]);

  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
          Heatmap
        </h2>
        <DateRangeSelector
          startDate={startDate} endDate={endDate}
          onChangeStart={setStartDate} onChangeEnd={setEndDate}
          preset={preset} onPreset={handlePreset}
        />
      </div>
      <div className="relative overflow-x-auto">
        <div className="flex gap-0.5">
          <div className="flex flex-col gap-0.5 mr-1">
            {dayLabels.map((label, i) => (
              <div
                key={i}
                className="w-4 h-4 text-[10px] text-zinc-400 dark:text-zinc-500 flex items-center justify-center"
              >
                {i % 2 === 0 ? label : ""}
              </div>
            ))}
          </div>
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

        <div className="flex items-center gap-2 mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          <span>Less</span>
          <div className="w-3 h-3 rounded-sm bg-zinc-200 dark:bg-zinc-700 opacity-40" />
          <div className="w-3 h-3 rounded-sm bg-red-500 opacity-80" />
          <div className="w-3 h-3 rounded-sm bg-yellow-500 opacity-70" />
          <div className="w-3 h-3 rounded-sm bg-green-500 opacity-80" />
          <div className="w-3 h-3 rounded-sm bg-green-500 opacity-100" />
          <span>More</span>
        </div>
      </div>

      {tooltip && (
        <div
          className="fixed z-50 px-2 py-1 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs rounded shadow-sm pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.date}: {tooltip.score !== null ? `${tooltip.score}%` : "No data"}
        </div>
      )}
    </div>
  );
}

// --- Score & Momentum Trend Chart ---
// --- Date Range Selector (shared) ---
// Desktop: pill buttons | Mobile: dropdown
function DateRangeSelector({
  startDate,
  endDate,
  onChangeStart,
  onChangeEnd,
  preset,
  onPreset,
  showDay = false,
}: {
  startDate: string;
  endDate: string;
  onChangeStart: (d: string) => void;
  onChangeEnd: (d: string) => void;
  preset: string;
  onPreset: (p: string) => void;
  showDay?: boolean;
}) {
  const allPresets = [
    { key: "day", label: "Day" },
    { key: "week", label: "Week" },
    { key: "month", label: "Month" },
    { key: "quarter", label: "Quarter" },
    { key: "custom", label: "Custom" },
  ];
  const presets = showDay ? allPresets : allPresets.filter(p => p.key !== "day");
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Mobile: dropdown */}
      <select
        value={preset}
        onChange={(e) => onPreset(e.target.value)}
        className="md:hidden px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border-0"
      >
        {presets.map((p) => (
          <option key={p.key} value={p.key}>{p.label}</option>
        ))}
      </select>
      {/* Desktop: pill buttons */}
      <div className="hidden md:flex items-center gap-1.5">
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => onPreset(p.key)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              preset === p.key
                ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-600"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset === "custom" && (
        <div className="flex items-center gap-1.5 text-xs">
          <input
            type="date"
            value={startDate}
            onChange={(e) => onChangeStart(e.target.value)}
            className="px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border-0 text-xs"
          />
          <span className="text-zinc-400">-</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onChangeEnd(e.target.value)}
            className="px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border-0 text-xs"
          />
        </div>
      )}
    </div>
  );
}

function getPresetDates(preset: string): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().split("T")[0];
  if (preset === "day") return { start: end, end };
  const s = new Date(now);
  if (preset === "week") s.setDate(s.getDate() - 7);
  else if (preset === "month") s.setDate(s.getDate() - 30);
  else if (preset === "quarter") s.setDate(s.getDate() - 90);
  else s.setDate(s.getDate() - 30);
  return { start: s.toISOString().split("T")[0], end };
}

function filterScoresByRange(scores: HistoryScore[], start: string, end: string) {
  return scores.filter((s) => s.date >= start && s.date <= end);
}

// --- Score Trend Chart (with date range) ---
function ScoreTrendChart({ scores }: { scores: HistoryScore[] }) {
  const [preset, setPreset] = useState("month");
  const [startDate, setStartDate] = useState(() => getPresetDates("month").start);
  const [endDate, setEndDate] = useState(() => getPresetDates("month").end);

  const handlePreset = (p: string) => {
    setPreset(p);
    if (p !== "custom") {
      const { start, end } = getPresetDates(p);
      setStartDate(start);
      setEndDate(end);
    }
  };

  const filtered = useMemo(() => filterScoresByRange(scores, startDate, endDate), [scores, startDate, endDate]);

  const data = useMemo(() => {
    return [...filtered]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => ({
        date: s.date.slice(5),
        fullDate: s.date,
        action: s.actionScore,
        momentum: s.momentumScore ?? null,
      }));
  }, [filtered]);

  const hasMomentum = data.some((d) => d.momentum !== null);

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
          {hasMomentum ? "Action Score & Momentum" : "Score Trend"}
        </h2>
        <DateRangeSelector
          startDate={startDate} endDate={endDate}
          onChangeStart={setStartDate} onChangeEnd={setEndDate}
          preset={preset} onPreset={handlePreset}
        />
      </div>
      {data.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400 text-sm text-center py-8">
          No score data for this period.
        </p>
      ) : (
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
              domain={[0, hasMomentum ? 'auto' : 100]}
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
              formatter={(value, name) => [
                `${value ?? 0}%`,
                name === "momentum" ? "Momentum" : "Action Score",
              ]}
              labelFormatter={(label: unknown) => `Date: ${label}`}
            />
            {hasMomentum && (
              <Legend
                formatter={(value: string) => value === "momentum" ? "Momentum" : "Action Score"}
              />
            )}
            <ReferenceLine
              y={hasMomentum ? 100 : 70}
              stroke="#22C55E"
              strokeDasharray="5 5"
              strokeOpacity={0.6}
              label={{
                value: hasMomentum ? "On Pace" : "Pass",
                position: "right",
                fill: "#22C55E",
                fontSize: 11,
              }}
            />
            <Line
              type="monotone"
              dataKey="action"
              stroke="#8B5CF6"
              strokeWidth={2}
              dot={{ fill: "#8B5CF6", r: 3 }}
              activeDot={{ r: 5, fill: "#A78BFA" }}
            />
            {hasMomentum && (
              <Line
                type="monotone"
                dataKey="momentum"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={{ fill: "#F59E0B", r: 3 }}
                activeDot={{ r: 5, fill: "#FCD34D" }}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// --- Pillar Performance (merged averages bar chart + today's breakdown, with date range) ---
function PillarPerformanceChart({
  scores,
  pillarsMeta,
}: {
  scores: HistoryScore[];
  pillarsMeta: PillarMeta[];
}) {
  const [preset, setPreset] = useState("month");
  const [startDate, setStartDate] = useState(() => getPresetDates("month").start);
  const [endDate, setEndDate] = useState(() => getPresetDates("month").end);

  const handlePreset = (p: string) => {
    setPreset(p);
    if (p !== "custom") {
      const { start, end } = getPresetDates(p);
      setStartDate(start);
      setEndDate(end);
    }
  };

  const filtered = useMemo(() => filterScoresByRange(scores, startDate, endDate), [scores, startDate, endDate]);

  const data = useMemo(() => {
    if (filtered.length === 0 || pillarsMeta.length === 0) return [];

    const totals: Record<number, { sum: number; count: number }> = {};
    for (const s of filtered) {
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
        id: p.id,
        name: p.name,
        emoji: p.emoji,
        color: p.color,
        weight: p.weight,
        avg: Math.round(totals[p.id].sum / totals[p.id].count),
      }));
  }, [filtered, pillarsMeta]);

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
          Pillar Performance
        </h2>
        <DateRangeSelector
          startDate={startDate} endDate={endDate}
          onChangeStart={setStartDate} onChangeEnd={setEndDate}
          preset={preset} onPreset={handlePreset}
          showDay
        />
      </div>
      {data.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400 text-sm text-center py-8">
          No pillar data for this period.
        </p>
      ) : (
        <div className="space-y-3">
          {data.map((pillar) => (
            <div key={pillar.id}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span>{pillar.emoji}</span>
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {pillar.name}
                  </span>
                  <span className="text-[10px] text-zinc-400">({pillar.weight}%)</span>
                </div>
                <span className="text-sm font-bold text-zinc-900 dark:text-white">
                  {pillar.avg}%
                </span>
              </div>
              <div className="w-full h-3 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(pillar.avg, 100)}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: pillar.color }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
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
    <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
          Streak Chain
        </h2>
        <div className="flex items-center gap-2">
          <FaFire className="text-orange-500 text-lg" />
          <span className="text-2xl font-bold text-orange-500">{currentStreak}</span>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {currentStreak === 1 ? "day" : "days"}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-0.5 md:gap-1 overflow-x-auto">
        {days.map((day, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5 md:gap-1 min-w-0 shrink-0">
            <span className="text-[9px] md:text-[10px] text-zinc-400 dark:text-zinc-500">
              {day.label}
            </span>
            <div
              className={`w-5 h-5 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[10px] md:text-sm ${
                day.status === "pass"
                  ? "bg-orange-500/20 text-orange-500"
                  : day.status === "fail"
                  ? "bg-red-500/20 text-red-400"
                  : "bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500"
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
            <span className="text-[8px] md:text-[9px] text-zinc-400 dark:text-zinc-500">
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
  const { dateFormat } = useTheme();
  const [score, setScore] = useState<DailyScoreData | null>(null);
  const [stats, setStats] = useState<UserStatsData | null>(null);
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

  useEffect(() => {
    if (status === "unauthenticated") {
      // Load demo data for non-logged-in users
      setScore(DEMO_DASHBOARD.score as DailyScoreData);
      setStats(DEMO_DASHBOARD.stats as UserStatsData);
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
      const [scoreRes, statsRes, historyRes, outcomesRes, tasksRes, momentumRes, completionsRes] = await Promise.all([
        fetch(`/api/daily-score?date=${today}`),
        fetch("/api/user-stats"),
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
      if (statsRes.ok) {
        setStats(await statsRes.json());
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
        const count = groups.reduce((sum: number, g: { tasks: unknown[] }) => sum + g.tasks.length, 0);
        setTodayTaskCount(count);
      }

      // Auto-seed for new users with no data
      if (scoreData && scoreData.totalTasks === 0 && !seedingRef.current) {
        seedingRef.current = true;
        setSeeding(true);
        const seedRes = await fetch("/api/seed", { method: "POST" });
        if (seedRes.ok) {
          setShowWelcome(true);
          // Re-fetch all data after seeding
          const [sr, str, hr, tr] = await Promise.all([
            fetch(`/api/daily-score?date=${today}`),
            fetch("/api/user-stats"),
            fetch("/api/daily-score/history?days=90"),
            fetch(`/api/tasks?date=${today}`),
          ]);
          if (sr.ok) setScore(await sr.json());
          if (str.ok) setStats(await str.json());
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


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 dark:border-zinc-100"></div>
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
            <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white">
              Dashboard
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {formatDate(new Date().toISOString().split('T')[0], dateFormat)}
            </p>
          </div>
          <Link href="/tasks">
            <button
              className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg font-medium"
            >
              Go to Tasks
            </button>
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
              <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <FaSun className="text-2xl text-amber-500" />
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
                    Today&apos;s Briefing
                  </h2>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  {/* Yesterday's Score */}
                  <div className="text-center">
                    <div className="text-2xl font-bold text-zinc-900 dark:text-white">
                      {yesterdayScore ? `${yesterdayScore.actionScore}%` : "—"}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      Yesterday
                    </div>
                  </div>

                  {/* Current Streak */}
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-500">
                      {stats.currentStreak}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      Day Streak
                    </div>
                  </div>

                  {/* Tasks Due */}
                  <div className="text-center">
                    <div className="text-2xl font-bold text-zinc-900 dark:text-white">
                      {todayTaskCount}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      Tasks Today
                    </div>
                  </div>
                </div>

                <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center italic">
                  {getStreakMessage(stats.currentStreak)}
                </p>
              </div>
            );
          })()
        )}

        {/* Welcome Banner for new users */}
        {showWelcome && (
          <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-4 mb-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">Welcome to TotalLogger!</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  We&apos;ve loaded sample pillars and tasks to help you get started. Feel free to edit, delete, or add your own.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={async () => {
                    if (!confirm("Clear all sample data? This will remove all pillars, tasks, and scores.")) return;
                    await fetch("/api/seed", { method: "DELETE" });
                    window.location.reload();
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Clear Data
                </button>
                <button
                  onClick={() => setShowWelcome(false)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                >
                  <FaTimes className="text-xs" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading seed state */}
        {seeding && (
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-8 mb-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-zinc-100 mx-auto mb-3"></div>
            <p className="text-zinc-600 dark:text-zinc-400">Setting up your sample data...</p>
          </div>
        )}

        {/* Action Score / Momentum / Trajectory — 3 circular boxes in a row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {/* Action Score */}
          <div title="Action Score: % of today's tasks completed. Higher = more productive day." className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 flex flex-col items-center justify-center text-center cursor-help">
            <div className="relative w-20 h-20 md:w-24 md:h-24">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-zinc-200 dark:text-zinc-700" />
                <motion.circle
                  cx="50" cy="50" r="42" fill="none"
                  strokeWidth="8" strokeLinecap="round"
                  stroke={score ? getTierColor(score.scoreTier) : "#6B7280"}
                  strokeDasharray={2 * Math.PI * 42}
                  initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - Math.min((score?.actionScore || 0) / 100, 1)) }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg md:text-xl font-bold text-zinc-900 dark:text-white leading-none">
                  {score ? `${score.actionScore}%` : "—"}
                </span>
              </div>
            </div>
            <div className="text-[10px] md:text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-2">Action Score</div>
            {score && (
              <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                {score.completedTasks}/{score.totalTasks} tasks
              </div>
            )}
          </div>

          {/* Momentum */}
          {(() => {
            const mVal = momentumData?.overall ?? 0;
            const mPct = Math.min(mVal / 2, 1); // 2.0x = full circle
            const mColor = mVal >= 1.0 ? "#22C55E" : "#EF4444";
            const mLabel = mVal >= 1.05 ? "Ahead" : mVal >= 0.95 ? "On track" : "Behind";
            return (
              <div title="Momentum: Are you keeping pace with your habitual and target goals? 1.0x = on pace, above = ahead, below = behind." className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 flex flex-col items-center justify-center text-center cursor-help">
                <div className="relative w-20 h-20 md:w-24 md:h-24">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-zinc-200 dark:text-zinc-700" />
                    <motion.circle
                      cx="50" cy="50" r="42" fill="none"
                      strokeWidth="8" strokeLinecap="round"
                      stroke={mColor}
                      strokeDasharray={2 * Math.PI * 42}
                      initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - mPct) }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg md:text-xl font-bold leading-none" style={{ color: mColor }}>
                      {momentumData ? `${mVal.toFixed(1)}x` : "—"}
                    </span>
                  </div>
                </div>
                <div className="text-[10px] md:text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-2">Momentum</div>
                {momentumData && (
                  <div className="text-[10px] text-zinc-400 dark:text-zinc-500">{mLabel}</div>
                )}
              </div>
            );
          })()}

          {/* Trajectory */}
          {(() => {
            const tVal = momentumData?.trajectory?.overall ?? 0;
            const tPct = Math.min(tVal / 2, 1); // 2.0x = full circle
            const tColor = tVal >= 1.0 ? "#A855F7" : "#EF4444";
            const tLabel = tVal >= 1.05 ? "Ahead" : tVal >= 0.95 ? "On track" : "Behind";
            return (
              <div title="Trajectory: Are your outcome goals trending in the right direction? 1.0x = on pace, above = ahead, below = behind." className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 flex flex-col items-center justify-center text-center cursor-help">
                <div className="relative w-20 h-20 md:w-24 md:h-24">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-zinc-200 dark:text-zinc-700" />
                    <motion.circle
                      cx="50" cy="50" r="42" fill="none"
                      strokeWidth="8" strokeLinecap="round"
                      stroke={tColor}
                      strokeDasharray={2 * Math.PI * 42}
                      initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - tPct) }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg md:text-xl font-bold leading-none" style={{ color: tColor }}>
                      {momentumData?.trajectory ? `${tVal.toFixed(1)}x` : "—"}
                    </span>
                  </div>
                </div>
                <div className="text-[10px] md:text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-2">Trajectory</div>
                {momentumData?.trajectory && (
                  <div className="text-[10px] text-zinc-400 dark:text-zinc-500">{tLabel}</div>
                )}
              </div>
            );
          })()}
        </div>


        {/* Goals Progress — compact list */}
        {outcomesData.length > 0 && (() => {
          const totalProgress = outcomesData.reduce((sum, o) => {
            if (o.goalType === 'habitual') {
              const doneDates = completionDates[o.id] || [];
              const scheduleDays: number[] = o.scheduleDays ? JSON.parse(o.scheduleDays) : [];
              const start = o.startDate || today;
              let expected = 0;
              const d = new Date(start + 'T00:00:00');
              const endD = new Date(today + 'T00:00:00');
              while (d <= endD) {
                if (scheduleDays.length === 0 || scheduleDays.includes(d.getDay())) expected++;
                d.setDate(d.getDate() + 1);
              }
              const hits = doneDates.filter(dt => dt >= start && dt <= today).length;
              return sum + (expected > 0 ? Math.min((hits / expected) * 100, 100) : 100);
            }
            const range = Math.abs(o.targetValue - o.startValue);
            if (range === 0) return sum + 100;
            const p = Math.abs(o.currentValue - o.startValue) / range * 100;
            return sum + Math.max(0, Math.min(p, 100));
          }, 0);
          const overallPct = Math.round(totalProgress / outcomesData.length);

          return (
            <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 mb-6">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <FaTrophy className="text-lg text-emerald-500" />
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Goals</h2>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-emerald-500">{overallPct}%</span>
                  <Link href="/goals">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300">View All</span>
                  </Link>
                </div>
              </div>
              {/* Overall bar */}
              <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden mb-3">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(overallPct, 100)}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="h-full rounded-full bg-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {outcomesData.map((goal) => {
                  const isHabitual = goal.goalType === 'habitual';
                  const range = Math.abs(goal.targetValue - goal.startValue);

                  // For habitual goals, compute adherence from completionDates
                  let progress: number;
                  let subtitle: string;
                  if (isHabitual) {
                    const doneDates = completionDates[goal.id] || [];
                    const scheduleDays: number[] = goal.scheduleDays ? JSON.parse(goal.scheduleDays) : [];
                    const start = goal.startDate || today;
                    const end = today;
                    let expected = 0;
                    const d = new Date(start + 'T00:00:00');
                    const endD = new Date(end + 'T00:00:00');
                    while (d <= endD) {
                      if (scheduleDays.length === 0 || scheduleDays.includes(d.getDay())) expected++;
                      d.setDate(d.getDate() + 1);
                    }
                    const hits = doneDates.filter(dt => dt >= start && dt <= end).length;
                    progress = expected > 0 ? Math.round((hits / expected) * 100) : 100;
                    subtitle = `${hits} / ${expected} days`;
                  } else {
                    progress = range === 0 ? 100 : Math.round(Math.max(0, Math.min(
                      Math.abs(goal.currentValue - goal.startValue) / range * 100, 100
                    )));
                    subtitle = `${goal.currentValue} / ${goal.targetValue} ${goal.unit}`;
                  }
                  const progressColor = progress < 30 ? "#EF4444" : progress < 60 ? "#F59E0B" : "#22C55E";

                  return (
                    <div
                      key={goal.id}
                      className="relative rounded-xl p-3 overflow-hidden border border-zinc-200 dark:border-zinc-700"
                    >
                      {/* Color fill from left based on progress */}
                      <div
                        className="absolute inset-0 opacity-15 dark:opacity-20"
                        style={{
                          background: progressColor,
                          width: `${progress}%`,
                        }}
                      />
                      <div className="relative">
                        <div className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{goal.name}</div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-lg font-bold" style={{ color: progressColor }}>{progress}%</span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Habit Tracker */}
        {(() => {
          const habitGoals = outcomesData.filter(o => o.goalType === 'habitual');
          if (habitGoals.length === 0) return null;

          const days: string[] = [];
          const now = new Date();
          for (let i = 13; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            days.push(d.toISOString().split('T')[0]);
          }

          const dayLabels = days.map(d => {
            const date = new Date(d + 'T12:00:00');
            return ['S','M','T','W','T','F','S'][date.getDay()];
          });

          return (
            <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FaFire className="text-lg text-orange-500" />
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Habits</h2>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-zinc-400 dark:text-zinc-500">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" /> Hit</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" /> Miss</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-zinc-200 dark:bg-zinc-700 inline-block" /> Rest</span>
                </div>
              </div>

              {/* Day labels */}
              <div className="flex items-center gap-0 mb-1">
                <div className="w-28 shrink-0" />
                <div className="flex-1 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
                  {dayLabels.map((label, i) => (
                    <div key={i} className="text-[9px] text-zinc-400 dark:text-zinc-500 text-center">{label}</div>
                  ))}
                </div>
              </div>

              {/* Goal rows */}
              <div className="space-y-1">
                {habitGoals.map(goal => {
                  const scheduleDays: number[] = goal.scheduleDays ? JSON.parse(goal.scheduleDays) : [];
                  const doneDates = new Set(completionDates[goal.id] || []);

                  return (
                    <div key={goal.id} className="flex items-center gap-0">
                      <div className="w-28 shrink-0 flex items-center gap-1.5 min-w-0">
                        {goal.pillarEmoji && <span className="text-xs">{goal.pillarEmoji}</span>}
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">{goal.name}</span>
                      </div>
                      <div className="flex-1 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
                        {days.map(dateStr => {
                          const d = new Date(dateStr + 'T12:00:00');
                          const dow = d.getDay();
                          const isScheduled = scheduleDays.length === 0 || scheduleDays.includes(dow);
                          const isBeforeStart = goal.startDate && dateStr < goal.startDate;
                          const isFuture = dateStr > today;

                          if (isBeforeStart || isFuture) {
                            return <div key={dateStr} className="aspect-square rounded-sm bg-zinc-100 dark:bg-zinc-800 opacity-30" />;
                          }
                          if (!isScheduled) {
                            return <div key={dateStr} className="aspect-square rounded-sm bg-zinc-200 dark:bg-zinc-700 opacity-40" />;
                          }
                          if (doneDates.has(dateStr)) {
                            return <div key={dateStr} className="aspect-square rounded-sm bg-green-500" />;
                          }
                          return <div key={dateStr} className="aspect-square rounded-sm bg-red-400" />;
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

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
        {history && <ScoreTrendChart scores={history.scores} />}

        {/* Pillar Performance (merged averages + today) */}
        {history && (
          <PillarPerformanceChart
            scores={history.scores}
            pillarsMeta={history.pillars}
          />
        )}
      </motion.div>
    </div>
  );
}
