"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaEdit,
  FaTrash,
  FaArrowUp,
  FaArrowDown,
  FaArrowLeft,
  FaEllipsisV,
  FaClipboardList,
  FaCopy,
  FaCheck,
  FaArchive,
} from "react-icons/fa";
import { calculateEffortMetrics } from "@/lib/effort-calculations";
import { getGoalBadge } from "@/lib/goal-badge";
import { formatDate, parseScheduleDays } from "@/lib/format";
import { formatScheduleLabel } from "@/lib/constants";
import { useTheme } from "@/components/ThemeProvider";
import { Outcome, LogEntry, LinkedTask, Cycle } from "../types";

export default function GoalCard({
  outcome,
  logsMap,
  menuOpen,
  setMenuOpen,
  openLogModal,
  handleArchive,
  handleStatusChange,
  getProgress,
  today,
  taskCompletionDates,
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
  handleStatusChange: (id: number, status: 'active' | 'completed' | 'abandoned') => void;
  getProgress: (o: Outcome) => number;
  today: string;
  taskCompletionDates: Record<number, { date: string; value: number; completed: boolean }[]>;
  onAddTask: (o: Outcome) => void;
  cycles: Cycle[];
  onCopyToCycle: (outcome: Outcome, cycleId: number) => void;
}) {
  const router = useRouter();
  const { dateFormat, habitualColor, targetColor, outcomeColor } = useTheme();
  const progress = getProgress(outcome);
  const color = outcome.pillarColor || "#3B82F6";
  const isHabitual = outcome.goalType === "habitual";
  const isProject = outcome.goalType === "project";
  const isActivityGoal = outcome.goalType === "target" || outcome.goalType === "habitual";
  const scheduleDays = useMemo(() => parseScheduleDays(outcome.scheduleDays), [outcome.scheduleDays]);
  const [showCyclePicker, setShowCyclePicker] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropUp, setDropUp] = useState(false);

  // Close menu on outside click
  useEffect(() => {
    if (menuOpen !== outcome.id) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen, outcome.id, setMenuOpen]);

  // Determine if menu should drop up
  useEffect(() => {
    if (menuOpen === outcome.id && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const bottomBarHeight = window.innerWidth < 768 ? 60 : 0;
      const spaceBelow = window.innerHeight - rect.bottom - bottomBarHeight;
      setDropUp(spaceBelow < 280);
    }
  }, [menuOpen, outcome.id]);

  const effortMetrics = useMemo(() => {
    if (!isActivityGoal || isHabitual || !outcome.startDate || !outcome.targetDate || scheduleDays.length === 0) return null;
    return calculateEffortMetrics(
      outcome.startDate, outcome.targetDate, scheduleDays,
      outcome.targetValue, outcome.currentValue, today, outcome.startValue
    );
  }, [isActivityGoal, isHabitual, outcome.startDate, outcome.targetDate, outcome.targetValue, outcome.currentValue, outcome.startValue, today, scheduleDays]);

  const allDoneDates = useMemo(() => {
    const dates = new Set<string>();
    for (const l of (logsMap[outcome.id] || [])) dates.add(l.loggedAt.split('T')[0]);
    for (const e of (taskCompletionDates[outcome.id] || [])) {
      if (e.completed) dates.add(e.date);
    }
    return dates;
  }, [logsMap, taskCompletionDates, outcome.id]);

  const adherence = useMemo(() => {
    if (!isHabitual || !outcome.startDate) return null;
    const start = outcome.startDate > today ? today : outcome.startDate;
    const entries = taskCompletionDates[outcome.id] || [];
    let expected = 0;
    const d = new Date(start + 'T00:00:00');
    const endD = new Date(today + 'T00:00:00');
    while (d <= endD) {
      if (scheduleDays.length === 0 || scheduleDays.includes(d.getDay())) expected++;
      d.setDate(d.getDate() + 1);
    }
    if (expected === 0) return null;

    // Filter: in range, positive value (exclude postpone markers -1)
    const filtered = entries.filter(e => e.date >= start && e.date <= today && e.value > 0);
    if (!outcome.dailyTarget || outcome.completionType === 'checkbox') {
      const uniqueDates = new Set(filtered.map(e => e.date));
      const logDates = new Set((logsMap[outcome.id] || [])
        .filter(l => { const d = l.loggedAt.split('T')[0]; return d >= start && d <= today; })
        .map(l => l.loggedAt.split('T')[0]));
      for (const ld of logDates) uniqueDates.add(ld);
      return Math.round((Math.min(uniqueDates.size, expected) / expected) * 100);
    }
    const dayValues = new Map<string, number>();
    for (const e of filtered) {
      dayValues.set(e.date, (dayValues.get(e.date) || 0) + e.value);
    }
    let hits = 0;
    for (const val of dayValues.values()) {
      hits += Math.min(val / outcome.dailyTarget, 1);
    }
    return Math.round((Math.min(hits, expected) / expected) * 100);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHabitual, outcome.startDate, outcome.id, outcome.dailyTarget, outcome.completionType, taskCompletionDates, logsMap, today, outcome.scheduleDays]);

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

  const scheduleLabel = useMemo(() => {
    if (scheduleDays.length === 0) return null;
    return formatScheduleLabel(scheduleDays);
  }, [scheduleDays]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 cursor-pointer hover:shadow transition-shadow"
      style={{
        borderLeftWidth: 4,
        borderLeftColor: color,
        borderRightWidth: 3,
        borderRightColor: outcome.goalType === 'habitual' ? habitualColor : outcome.goalType === 'target' ? targetColor : outcomeColor,
      }}
      onClick={() => router.push(`/goals/${outcome.id}`)}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-zinc-900 dark:text-white truncate">{outcome.name}</h3>
            {outcome.pillarName && (
              <span
                className="text-[10px] px-1.5 py-px rounded-full font-medium shrink-0"
                style={{ backgroundColor: color + '20', color }}
              >
                {outcome.pillarEmoji ? `${outcome.pillarEmoji} ` : ''}{outcome.pillarName}
              </span>
            )}
            <span className="text-[11px] px-1.5 py-px rounded-full font-medium bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400 shrink-0">
              {outcome.goalType === "habitual" ? "Habitual" : outcome.goalType === "target" || outcome.goalType === "effort" ? "Target" : isProject ? "Project" : "Outcome"}
            </span>
            {outcome.flexibilityRule === "limit_avoid" && (
              <span className="text-[10px] px-1.5 py-px rounded-full font-medium bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 shrink-0">
                Limit
              </span>
            )}
            {outcome.status === 'completed' && (
              <span className="text-[10px] px-1.5 py-px rounded-full font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 shrink-0">
                Completed
              </span>
            )}
            {outcome.status === 'abandoned' && (
              <span className="text-[10px] px-1.5 py-px rounded-full font-medium bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 shrink-0">
                Abandoned
              </span>
            )}
            {!isActivityGoal && !isProject && (
              outcome.targetValue < outcome.startValue ? (
                <FaArrowDown className={`text-xs shrink-0 ${progress > 0 ? 'text-green-500' : 'text-red-500'}`} />
              ) : (
                <FaArrowUp className={`text-xs shrink-0 ${progress > 0 ? 'text-green-500' : 'text-red-500'}`} />
              )
            )}
            {isHabitual && adherence !== null && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                adherence >= 95 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                adherence >= 75 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                adherence >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                adherence >= 25 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {adherence}%
              </span>
            )}
            {isHabitual && streak > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 font-medium whitespace-nowrap shrink-0">
                {streak}🔥
              </span>
            )}
            {(() => {
              const badge = getGoalBadge(outcome, today);
              if (!badge) return null;
              return (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0" style={{ backgroundColor: badge.color + '18', color: badge.color }}>
                  {badge.value.toFixed(1)}x
                </span>
              );
            })()}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            {isHabitual ? (
              <>
                {outcome.dailyTarget ? <span className="whitespace-nowrap">{outcome.dailyTarget} {outcome.unit}/session</span> : <span>{outcome.unit}</span>}
              </>
            ) : isActivityGoal ? (
              <>
                <span className="whitespace-nowrap">{outcome.currentValue} / {outcome.targetValue} {outcome.unit}</span>
                <span className="font-medium">{Math.round(progress)}%</span>
                {effortMetrics && (
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 whitespace-nowrap">· {effortMetrics.requiredRate}/day</span>
                )}
              </>
            ) : isProject ? (
              <>
                {outcome.targetValue > 0 ? (
                  <>
                    <span className="whitespace-nowrap">{outcome.currentValue} of {outcome.targetValue} steps</span>
                    <span className="font-medium">{Math.round(progress)}%</span>
                  </>
                ) : (
                  <span className="whitespace-nowrap">No steps yet</span>
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
            {scheduleLabel && (
              <span className="text-[10px] px-1.5 py-px rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 font-medium whitespace-nowrap">
                {scheduleLabel}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
