"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  FaArrowLeft,
  FaEdit,
  FaArchive,
  FaArrowUp,
  FaArrowDown,
  FaSortAmountDown,
  FaSortAmountUp,
} from "react-icons/fa";
import { calculateEffortMetrics } from "@/lib/effort-calculations";
import { Outcome, LogEntry, LinkedTask } from "../types";
import { DAY_NAMES } from "../constants";
import HabitHeatmap from "../components/HabitHeatmap";
import ProgressChart from "../components/ProgressChart";
import { formatDate } from "@/lib/format";
import { useTheme } from "@/components/ThemeProvider";

export default function GoalDetailPage() {
  const { data: session, status } = useSession();
  const { dateFormat } = useTheme();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [linkedTasks, setLinkedTasks] = useState<LinkedTask[]>([]);
  const [taskCompletionDates, setTaskCompletionDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [sortCol, setSortCol] = useState<"date" | "points" | "status">("date");
  const [sortAsc, setSortAsc] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (status === "unauthenticated") {
      setLoading(false);
      return;
    }
    if (session?.user?.id) {
      Promise.all([
        fetch("/api/outcomes").then((r) => r.ok ? r.json() : []),
        fetch(`/api/outcomes/${id}/log`).then((r) => r.ok ? r.json() : []),
        fetch("/api/tasks").then((r) => r.ok ? r.json() : []),
        fetch("/api/outcomes/completions").then((r) => r.ok ? r.json() : {}),
      ]).then(([outcomes, logData, taskGroups, completions]) => {
        const found = outcomes.find((o: Outcome) => String(o.id) === id);
        setOutcome(found || null);
        setLogs(logData);

        const tasks: LinkedTask[] = [];
        for (const group of taskGroups) {
          for (const task of group.tasks) {
            if (task.outcomeId === parseInt(id)) {
              tasks.push({
                id: task.id,
                name: task.name,
                outcomeId: task.outcomeId,
                frequency: task.frequency || "daily",
                completionType: task.completionType || "checkbox",
                basePoints: task.basePoints || 0,
                target: task.target ?? null,
                unit: task.unit ?? null,
                completed: task.completion?.completed || false,
                value: task.completion?.value ?? null,
                startDate: task.startDate || null,
              });
            }
          }
        }
        setLinkedTasks(tasks);
        setTaskCompletionDates(completions[parseInt(id)] || []);
        setLoading(false);
      });
    }
  }, [session, status, router, id]);

  const scheduleDays: number[] = outcome?.scheduleDays ? JSON.parse(outcome.scheduleDays) : [];
  const isHabitual = outcome?.goalType === "habitual";
  const isActivityGoal = outcome?.goalType === "target" || outcome?.goalType === "habitual";
  const color = outcome?.pillarColor || "#3B82F6";

  const getProgress = (o: Outcome) => {
    const range = Math.abs(o.targetValue - o.startValue);
    if (range === 0) return 100;
    return Math.max(0, Math.min(Math.abs(o.currentValue - o.startValue) / range * 100, 100));
  };

  const progress = outcome ? getProgress(outcome) : 0;

  const effortMetrics = useMemo(() => {
    if (!outcome || !isActivityGoal || !outcome.startDate || !outcome.targetDate || scheduleDays.length === 0) return null;
    return calculateEffortMetrics(
      outcome.startDate, outcome.targetDate, scheduleDays,
      outcome.targetValue, outcome.currentValue, today
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome, isActivityGoal, today]);

  const allDoneDates = useMemo(() => {
    const dates = new Set<string>();
    for (const l of logs) dates.add(l.loggedAt.split('T')[0]);
    for (const d of taskCompletionDates) dates.add(d);
    return dates;
  }, [logs, taskCompletionDates]);

  const streak = useMemo(() => {
    if (!isHabitual || allDoneDates.size === 0) return 0;
    let count = 0;
    const d = new Date(today + 'T12:00:00');
    if (!allDoneDates.has(today)) d.setDate(d.getDate() - 1);
    while (true) {
      const dateStr = d.toISOString().split('T')[0];
      if (scheduleDays.length > 0 && !scheduleDays.includes(d.getDay())) {
        d.setDate(d.getDate() - 1);
        continue;
      }
      if (allDoneDates.has(dateStr)) {
        count++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return count;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHabitual, allDoneDates, today]);

  const sortedTasks = useMemo(() => {
    const sorted = [...linkedTasks].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "date":
          cmp = (a.startDate || "").localeCompare(b.startDate || "");
          break;
        case "points":
          cmp = a.basePoints - b.basePoints;
          break;
        case "status":
          cmp = (a.completed ? 1 : 0) - (b.completed ? 1 : 0);
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }, [linkedTasks, sortCol, sortAsc]);

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  const frequencyLabel = (freq: string) => {
    switch (freq) {
      case "daily": return "Daily";
      case "weekly": return "Weekly";
      case "monthly": return "Monthly";
      case "adhoc": return "One-time";
      case "custom": return "Custom";
      case "interval": return "Interval";
      default: return freq;
    }
  };

  const handleArchive = async () => {
    if (!outcome || !confirm("Archive this goal?")) return;
    setArchiving(true);
    await fetch(`/api/outcomes/${outcome.id}`, { method: "DELETE" });
    router.push("/goals");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-600"></div>
      </div>
    );
  }

  if (!outcome) {
    return (
      <div className="container mx-auto px-4 py-4 md:py-8 max-w-4xl">
        <p className="text-zinc-500 dark:text-zinc-400">Goal not found.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push("/goals")}
            className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 shrink-0"
          >
            <FaArrowLeft />
          </button>
          <h1 className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-white truncate">{outcome.name}</h1>
          {!isActivityGoal && (
            outcome.direction === "decrease" ? (
              <FaArrowDown className="text-green-500 shrink-0" />
            ) : (
              <FaArrowUp className="text-green-500 shrink-0" />
            )
          )}
          {outcome.pillarName && (
            <span className="text-sm shrink-0 hidden md:inline" style={{ color: outcome.pillarColor || "#6B7280" }}>
              {outcome.pillarEmoji} {outcome.pillarName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => router.push(`/goals/${outcome.id}/edit`)}
            className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
            title="Edit"
          >
            <FaEdit />
          </button>
          <button
            onClick={handleArchive}
            disabled={archiving}
            className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
            title="Archive"
          >
            <FaArchive />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Summary row: metrics + status badge inline */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
          {isHabitual ? (
            <>
              {outcome.dailyTarget ? <span>{outcome.dailyTarget} {outcome.unit}/session</span> : <span>{outcome.unit}</span>}
              <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 font-medium">
                {streak} day streak
              </span>
            </>
          ) : (
            <>
              <span className="text-lg font-semibold text-zinc-900 dark:text-white">
                {outcome.currentValue} / {outcome.targetValue} {outcome.unit}
              </span>
              <span className="font-medium">{Math.round(progress)}%</span>
              {effortMetrics && <span>{effortMetrics.currentRate}/day</span>}
            </>
          )}
          {isActivityGoal && effortMetrics && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              effortMetrics.status === 'ahead' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
              effortMetrics.status === 'on_track' ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' :
              'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {effortMetrics.status === 'ahead' ? 'Ahead' : effortMetrics.status === 'on_track' ? 'On track' : 'Behind'}
            </span>
          )}
          {/* Dates inline */}
          {outcome.startDate && (
            <span className="text-xs">
              {formatDate(outcome.startDate, dateFormat)}
              {outcome.targetDate && ` - ${formatDate(outcome.targetDate, dateFormat)}`}
            </span>
          )}
          {/* Schedule days inline */}
          {isActivityGoal && scheduleDays.length > 0 && scheduleDays.length < 7 && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {scheduleDays.map((d) => DAY_NAMES[d]).join(", ")}
            </span>
          )}
        </div>

        {/* Progress bar (target/outcome) */}
        {!isHabitual && (
          <div>
            <div className="w-full h-3 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(progress, 100)}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ backgroundColor: color }}
              />
            </div>
            <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              <span>{outcome.startValue} {outcome.unit}</span>
              <span>{outcome.targetValue} {outcome.unit}</span>
            </div>
          </div>
        )}

        {/* Effort Metrics - compact grid */}
        {!isHabitual && isActivityGoal && effortMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div className="bg-zinc-50 dark:bg-zinc-700/50 rounded-lg px-3 py-2">
              <span className="text-zinc-500 dark:text-zinc-400 text-xs">Today&apos;s target: </span>
              <span className="font-semibold text-zinc-900 dark:text-white">{effortMetrics.dailyTarget} {outcome.unit}</span>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-700/50 rounded-lg px-3 py-2">
              <span className="text-zinc-500 dark:text-zinc-400 text-xs">Required: </span>
              <span className="font-semibold text-zinc-900 dark:text-white">{effortMetrics.requiredRate}/day</span>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-700/50 rounded-lg px-3 py-2">
              <span className="text-zinc-500 dark:text-zinc-400 text-xs">Current: </span>
              <span className="font-semibold text-zinc-900 dark:text-white">{effortMetrics.currentRate}/day</span>
            </div>
            {effortMetrics.projectedDate && (
              <div className="bg-zinc-50 dark:bg-zinc-700/50 rounded-lg px-3 py-2">
                <span className="text-zinc-500 dark:text-zinc-400 text-xs">Projected: </span>
                <span className="font-semibold text-zinc-900 dark:text-white">
                  {formatDate(effortMetrics.projectedDate, dateFormat)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Habitual Heatmap */}
        {isHabitual && outcome.startDate && (
          <HabitHeatmap
            startDate={outcome.startDate}
            endDate={outcome.targetDate}
            scheduleDays={scheduleDays}
            doneDates={allDoneDates}
            today={today}
          />
        )}

        {/* Progress Chart */}
        {!isHabitual && (
          <ProgressChart
            outcome={outcome}
            logs={logs}
            color={color}
          />
        )}

        {/* Linked Tasks Table */}
        {linkedTasks.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Linked Tasks</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700 text-left text-xs text-zinc-500 dark:text-zinc-400">
                    {([
                      { key: "date" as const, label: "Date" },
                      { key: "status" as const, label: "Status" },
                    ]).map(col => (
                      <th
                        key={col.key}
                        className="pb-2 pr-3 font-medium cursor-pointer select-none hover:text-zinc-700 dark:hover:text-zinc-200"
                        onClick={() => toggleSort(col.key)}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {sortCol === col.key && (
                            sortAsc ? <FaSortAmountUp className="text-[9px]" /> : <FaSortAmountDown className="text-[9px]" />
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedTasks.map(task => (
                    <tr
                      key={task.id}
                      className="border-b border-zinc-100 dark:border-zinc-700/50 hover:bg-zinc-50 dark:hover:bg-zinc-700/30 cursor-pointer"
                      onClick={() => router.push(`/tasks/${task.id}/edit`)}
                    >
                      <td className="py-2 pr-3 text-zinc-900 dark:text-white">
                        {task.startDate ? formatDate(task.startDate, dateFormat) : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {task.completed ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">
                            {task.completionType !== "checkbox" && task.value != null
                              ? `${task.value}${task.unit ? ` ${task.unit}` : ""}`
                              : "Done"}
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400 font-medium">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
