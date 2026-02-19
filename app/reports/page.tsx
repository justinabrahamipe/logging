"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  FaChevronLeft,
  FaChevronRight,
  FaArrowUp,
  FaArrowDown,
  FaFire,
  FaStar,
  FaTrophy,
  FaBolt,
  FaHistory,
} from "react-icons/fa";
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

interface ReportData {
  type: "weekly" | "monthly";
  dateRange: { start: string; end: string };
  summary: {
    avgScore: number;
    passingDays: number;
    totalDays: number;
    bestDay: { date: string; score: number };
    worstDay: { date: string; score: number };
    totalXpEarned: number;
    currentStreak: number;
    bestStreak: number;
  };
  pillarBreakdown: Array<{
    id: number;
    name: string;
    emoji: string;
    color: string;
    avgScore: number;
  }>;
  dailyScores: Array<{
    date: string;
    actionScore: number;
    isPassing: boolean;
  }>;
  topTasks: Array<{ name: string; completionRate: number; pillarEmoji: string }>;
  skippedTasks: Array<{ name: string; completionRate: number; pillarEmoji: string }>;
  outcomeProgress: Array<{
    name: string;
    unit: string;
    direction: string;
    startOfPeriod: number;
    endOfPeriod: number;
    change: number;
    pillarColor: string | null;
  }>;
}

interface SavedReport {
  id: number;
  type: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  data: string;
}

function getTierColor(score: number): string {
  if (score >= 95) return "#FFD700";
  if (score >= 85) return "#22C55E";
  if (score >= 70) return "#3B82F6";
  if (score >= 50) return "#F59E0B";
  if (score >= 30) return "#F97316";
  return "#EF4444";
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const sMonth = s.toLocaleDateString("en-US", { month: "short" });
  const eMonth = e.toLocaleDateString("en-US", { month: "short" });
  if (sMonth === eMonth) {
    return `${sMonth} ${s.getDate()} - ${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${sMonth} ${s.getDate()} - ${eMonth} ${e.getDate()}, ${e.getFullYear()}`;
}

export default function ReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<"weekly" | "monthly">("weekly");
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [tab, setTab] = useState<"live" | "saved">("live");
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const reportCache = useRef<Map<string, ReportData>>(new Map());

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchReport();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, type, endDate]);

  const fetchReport = async () => {
    const cacheKey = `${type}-${endDate}`;
    const cached = reportCache.current.get(cacheKey);
    if (cached) {
      setReport(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/reports?type=${type}&date=${endDate}`);
      if (res.ok) {
        const data = await res.json();
        reportCache.current.set(cacheKey, data);
        setReport(data);
      }
    } catch (error) {
      console.error("Failed to fetch report:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSavedReports = async () => {
    setSavedLoading(true);
    try {
      const res = await fetch("/api/reports/saved");
      if (res.ok) {
        setSavedReports(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch saved reports:", error);
    } finally {
      setSavedLoading(false);
    }
  };

  const loadSavedReport = (saved: SavedReport) => {
    const data = JSON.parse(saved.data) as ReportData;
    setReport(data);
    setType(data.type as "weekly" | "monthly");
    setEndDate(saved.periodEnd);
    setTab("live");
  };

  const navigatePeriod = (direction: "prev" | "next") => {
    const d = new Date(endDate + "T00:00:00");
    const days = type === "monthly" ? 30 : 7;
    if (direction === "prev") {
      d.setDate(d.getDate() - days);
    } else {
      d.setDate(d.getDate() + days);
    }
    // Don't go into the future
    const today = new Date().toISOString().split("T")[0];
    const newDate = d.toISOString().split("T")[0];
    if (newDate > today) {
      setEndDate(today);
    } else {
      setEndDate(newDate);
    }
  };

  const isCurrentPeriod = endDate === new Date().toISOString().split("T")[0];

  // Chart data
  const chartData = useMemo(() => {
    if (!report) return [];
    return report.dailyScores.map((s) => ({
      date: s.date.slice(5),
      fullDate: s.date,
      score: s.actionScore,
    }));
  }, [report]);

  const pillarChartData = useMemo(() => {
    if (!report) return [];
    return report.pillarBreakdown
      .filter((p) => p.avgScore > 0)
      .map((p) => ({
        name: `${p.emoji} ${p.name}`,
        avg: p.avgScore,
        color: p.color,
      }));
  }, [report]);

  if (loading && !report) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const hasData = report && report.dailyScores.length > 0;

  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Reports
          </h1>

          {/* Live vs Saved Toggle */}
          <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
            <button
              onClick={() => setTab("live")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                tab === "live"
                  ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Live
            </button>
            <button
              onClick={() => { setTab("saved"); fetchSavedReports(); }}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1 ${
                tab === "saved"
                  ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <FaHistory className="text-xs" /> Saved
            </button>
          </div>

          {/* Period Toggle */}
          {tab === "live" && <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setType("weekly")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                type === "weekly"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setType("monthly")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                type === "monthly"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              Monthly
            </button>
          </div>}

          {/* Date Navigation */}
          {tab === "live" && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigatePeriod("prev")}
                className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                <FaChevronLeft />
              </button>
              <span className="text-lg font-medium text-gray-900 dark:text-white min-w-[200px] text-center">
                {report ? formatDateRange(report.dateRange.start, report.dateRange.end) : "..."}
              </span>
              <button
                onClick={() => navigatePeriod("next")}
                disabled={isCurrentPeriod}
                className={`p-2 rounded-lg transition-colors ${
                  isCurrentPeriod
                    ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                <FaChevronRight />
              </button>
            </div>
          )}
        </div>

        {/* Saved Reports Tab */}
        {tab === "saved" && (
          <div className="space-y-3">
            {savedLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : savedReports.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
                <p className="text-lg text-gray-500 dark:text-gray-400">No saved reports yet</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Reports are auto-generated weekly on Mondays and monthly on the 1st</p>
              </div>
            ) : (
              savedReports.map((saved) => (
                <button
                  key={saved.id}
                  onClick={() => loadSavedReport(saved)}
                  className="w-full text-left bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        saved.type === "weekly"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                      }`}>
                        {saved.type === "weekly" ? "Weekly" : "Monthly"}
                      </span>
                      <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                        {formatDateRange(saved.periodStart, saved.periodEnd)}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      Generated {new Date(saved.generatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Loading overlay for period changes */}
        {tab === "live" && loading && report && (
          <div className="flex justify-center py-4 mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Empty State */}
        {tab === "live" && !hasData && !loading && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
            <p className="text-lg text-gray-500 dark:text-gray-400">
              No data for this period. Try navigating to a different date range.
            </p>
          </div>
        )}

        {tab === "live" && hasData && report && (
          <>
            {/* Summary Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <FaBolt className="text-2xl text-yellow-500" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Summary</h2>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {/* Avg Score */}
                <div className="text-center">
                  <div
                    className="text-4xl font-bold"
                    style={{ color: getTierColor(report.summary.avgScore) }}
                  >
                    {report.summary.avgScore}%
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Avg Score</div>
                </div>

                {/* Passing Days */}
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-500">
                    {report.summary.passingDays}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    / {report.dailyScores.length} Passing
                  </div>
                </div>

                {/* Best Day */}
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-500">
                    {report.summary.bestDay.score}%
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Best ({formatDate(report.summary.bestDay.date)})
                  </div>
                </div>

                {/* Worst Day */}
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-500">
                    {report.summary.worstDay.score}%
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Worst ({formatDate(report.summary.worstDay.date)})
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Score Trend Chart */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-6"
            >
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Score Trend
              </h2>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
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
                      label={{ value: "Pass", position: "right", fill: "#22C55E", fontSize: 11 }}
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
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-8">
                  No score data for this period.
                </p>
              )}
            </motion.div>

            {/* Pillar Averages Chart */}
            {pillarChartData.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-6"
              >
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Pillar Averages
                </h2>
                <ResponsiveContainer width="100%" height={pillarChartData.length * 50 + 20}>
                  <BarChart
                    data={pillarChartData}
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
                      {pillarChartData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            )}

            {/* Top Tasks */}
            {report.topTasks.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-6"
              >
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Top Tasks
                </h2>
                <div className="space-y-3">
                  {report.topTasks.map((task, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-lg">{task.pillarEmoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                            {task.name}
                          </span>
                          <span className="text-sm font-bold text-gray-900 dark:text-white ml-2">
                            {task.completionRate}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${task.completionRate}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="h-full rounded-full bg-green-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Most Skipped Tasks */}
            {report.skippedTasks.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-6"
              >
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Most Skipped Tasks
                </h2>
                <div className="space-y-3">
                  {report.skippedTasks.map((task, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-lg">{task.pillarEmoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                            {task.name}
                          </span>
                          <span className="text-sm font-bold text-gray-900 dark:text-white ml-2">
                            {task.completionRate}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${task.completionRate}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="h-full rounded-full bg-orange-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Outcome Progress */}
            {report.outcomeProgress.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-6"
              >
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Outcome Progress
                </h2>
                <div className="space-y-4">
                  {report.outcomeProgress.map((outcome, i) => {
                    const isPositive =
                      (outcome.direction === "increase" && outcome.change > 0) ||
                      (outcome.direction === "decrease" && outcome.change < 0);
                    const changeAbs = Math.abs(outcome.change);

                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-2 h-8 rounded-full"
                            style={{ backgroundColor: outcome.pillarColor || "#6B7280" }}
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {outcome.name}
                            </span>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {outcome.startOfPeriod} → {outcome.endOfPeriod} {outcome.unit}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {outcome.change !== 0 ? (
                            <>
                              {isPositive ? (
                                <FaArrowUp className="text-green-500 text-xs" />
                              ) : (
                                <FaArrowDown className="text-red-500 text-xs" />
                              )}
                              <span
                                className={`text-sm font-bold ${
                                  isPositive ? "text-green-500" : "text-red-500"
                                }`}
                              >
                                {changeAbs.toFixed(1)} {outcome.unit}
                              </span>
                            </>
                          ) : (
                            <span className="text-sm text-gray-400">No change</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* XP & Streak */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
            >
              {/* XP Earned */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 text-center">
                <FaTrophy className="text-3xl text-purple-500 mx-auto mb-2" />
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {report.summary.totalXpEarned}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">XP Earned</div>
              </div>

              {/* Current Streak */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 text-center">
                <FaFire className="text-3xl text-orange-500 mx-auto mb-2" />
                <div className="text-3xl font-bold text-orange-500">
                  {report.summary.currentStreak}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Current Streak</div>
              </div>

              {/* Best Streak */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 text-center">
                <FaStar className="text-3xl text-yellow-500 mx-auto mb-2" />
                <div className="text-3xl font-bold text-yellow-500">
                  {report.summary.bestStreak}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Best Streak</div>
              </div>
            </motion.div>
          </>
        )}
      </motion.div>
    </div>
  );
}
