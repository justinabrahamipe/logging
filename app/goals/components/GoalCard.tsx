"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaEdit,
  FaTrash,
  FaArrowUp,
  FaArrowDown,
  FaEllipsisV,
  FaClipboardList,
  FaCopy,
} from "react-icons/fa";
import { calculateEffortMetrics } from "@/lib/effort-calculations";
import { formatDate } from "@/lib/format";
import { useTheme } from "@/components/ThemeProvider";
import { Outcome, LogEntry, LinkedTask, Cycle } from "../types";

export default function GoalCard({
  outcome,
  logsMap,
  linkedTasks,
  menuOpen,
  setMenuOpen,
  openLogModal,
  handleArchive,
  getProgress,
  today,
  taskCompletionDates,
  onAddTask,
  cycles,
  onCopyToCycle,
}: {
  outcome: Outcome;
  logsMap: Record<number, LogEntry[]>;
  linkedTasks: LinkedTask[];
  menuOpen: number | null;
  setMenuOpen: (id: number | null) => void;
  openLogModal: (o: Outcome) => void;
  handleArchive: (id: number) => void;
  getProgress: (o: Outcome) => number;
  today: string;
  taskCompletionDates: Record<number, string[]>;
  onAddTask: (o: Outcome) => void;
  cycles: Cycle[];
  onCopyToCycle: (outcome: Outcome, cycleId: number) => void;
}) {
  const router = useRouter();
  const { dateFormat } = useTheme();
  const progress = getProgress(outcome);
  const color = outcome.pillarColor || "#3B82F6";
  const isHabitual = outcome.goalType === "habitual";
  const isActivityGoal = outcome.goalType === "target" || outcome.goalType === "habitual";
  const scheduleDays: number[] = outcome.scheduleDays ? JSON.parse(outcome.scheduleDays) : [];
  const [showCyclePicker, setShowCyclePicker] = useState(false);

  const effortMetrics = useMemo(() => {
    if (!isActivityGoal || !outcome.startDate || !outcome.targetDate || scheduleDays.length === 0) return null;
    return calculateEffortMetrics(
      outcome.startDate, outcome.targetDate, scheduleDays,
      outcome.targetValue, outcome.currentValue, today
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActivityGoal, outcome.startDate, outcome.targetDate, outcome.targetValue, outcome.currentValue, today, outcome.scheduleDays]);

  const allDoneDates = useMemo(() => {
    const dates = new Set<string>();
    for (const l of (logsMap[outcome.id] || [])) dates.add(l.loggedAt.split('T')[0]);
    for (const d of (taskCompletionDates[outcome.id] || [])) dates.add(d);
    return dates;
  }, [logsMap, taskCompletionDates, outcome.id]);

  const streak = useMemo(() => {
    if (!isHabitual) return 0;
    if (allDoneDates.size === 0) return 0;
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
  }, [isHabitual, allDoneDates, today, scheduleDays]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 cursor-pointer hover:shadow transition-shadow"
      style={{ borderLeftWidth: 4, borderLeftColor: color }}
      onClick={() => router.push(`/goals/${outcome.id}`)}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-zinc-900 dark:text-white truncate">{outcome.name}</h3>
            <span className="text-[11px] px-1.5 py-px rounded-full font-medium bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400 shrink-0">
              {outcome.goalType === "habitual" ? "Habitual" : outcome.goalType === "target" || outcome.goalType === "effort" ? "Target" : "Outcome"}
            </span>
            {!isActivityGoal && (
              outcome.direction === "decrease" ? (
                <FaArrowDown className="text-xs text-green-500 shrink-0" />
              ) : (
                <FaArrowUp className="text-xs text-green-500 shrink-0" />
              )
            )}
            {isActivityGoal && effortMetrics && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                effortMetrics.status === 'ahead' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                effortMetrics.status === 'on_track' ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-400' :
                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {effortMetrics.status === 'ahead' ? 'Ahead' : effortMetrics.status === 'on_track' ? 'On track' : 'Behind'}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            {isHabitual ? (
              <>
                {outcome.dailyTarget ? <span className="whitespace-nowrap">{outcome.dailyTarget} {outcome.unit}/session</span> : <span>{outcome.unit}</span>}
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 font-medium whitespace-nowrap">
                  {streak}🔥
                </span>
              </>
            ) : isActivityGoal ? (
              <>
                <span className="whitespace-nowrap">{outcome.currentValue} / {outcome.targetValue} {outcome.unit}</span>
                <span className="font-medium">{Math.round(progress)}%</span>
                {effortMetrics && (
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 whitespace-nowrap">· {effortMetrics.dailyTarget} {outcome.unit}/day</span>
                )}
              </>
            ) : (
              <>
                <span className="whitespace-nowrap">{outcome.currentValue} / {outcome.targetValue} {outcome.unit}</span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </>
            )}
            {outcome.startDate && (
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
                {formatDate(outcome.startDate, dateFormat)}{outcome.targetDate ? ` – ${formatDate(outcome.targetDate, dateFormat)}` : ''}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center shrink-0" onClick={e => e.stopPropagation()}>
          <div className="relative">
            <button
              onClick={() => { setMenuOpen(menuOpen === outcome.id ? null : outcome.id); setShowCyclePicker(false); }}
              className="p-2 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              <FaEllipsisV className="text-sm" />
            </button>
            <AnimatePresence>
              {menuOpen === outcome.id && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 top-8 w-52 bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 z-20 overflow-hidden"
                >
                  <button
                    onClick={() => openLogModal(outcome)}
                    className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                  >
                    <FaClipboardList /> Log Progress
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setShowCyclePicker(!showCyclePicker)}
                      className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                    >
                      <FaCopy /> Copy to Cycle
                    </button>
                    {showCyclePicker && (
                      <div className="border-t border-zinc-200 dark:border-zinc-700 max-h-48 overflow-y-auto">
                        {cycles.length === 0 ? (
                          <p className="px-4 py-2.5 text-sm text-zinc-400">No cycles available</p>
                        ) : (
                          cycles.map((cycle) => (
                            <button
                              key={cycle.id}
                              onClick={() => {
                                onCopyToCycle(outcome, cycle.id);
                                setShowCyclePicker(false);
                                setMenuOpen(null);
                              }}
                              className="w-full px-6 py-2 text-left text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 flex items-center justify-between"
                            >
                              <span className="truncate">{cycle.name}</span>
                              {cycle.isActive && <span className="text-[10px] px-1.5 py-px rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 ml-2 shrink-0">Active</span>}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setMenuOpen(null);
                      router.push(`/goals/${outcome.id}/edit`);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                  >
                    <FaEdit /> Edit
                  </button>
                  <button
                    onClick={() => handleArchive(outcome.id)}
                    className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <FaTrash /> Delete
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
