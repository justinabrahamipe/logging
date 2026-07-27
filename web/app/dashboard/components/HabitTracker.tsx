"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import { FaFire } from "react-icons/fa";
import Link from "next/link";
import type { OutcomeData } from "@/lib/types";
import { parseScheduleDays } from "@/lib/format";

interface HabitTrackerProps {
  outcomesData: OutcomeData[];
  completionDates: Record<number, { date: string; value: number; completed: boolean }[]>;
  today: string;
}

const CELL_SIZE = 14; // w-3.5 = 14px
const CELL_GAP = 2;  // gap-0.5 = 2px
const PCT_W = 44; // w-11
const NAME_MIN = 140; // minimum space for habit name
const ML_GAP = 8; // ml-2

export default function HabitTracker({ outcomesData, completionDates, today }: HabitTrackerProps) {
  const habitGoals = outcomesData.filter(o => o.goalType === 'habitual');
  if (habitGoals.length === 0) return null;

  const containerRef = useRef<HTMLDivElement>(null);
  const [dayCount, setDayCount] = useState(14);

  useEffect(() => {
    const calculate = () => {
      if (!containerRef.current) return;
      const totalWidth = containerRef.current.offsetWidth;
      const available = totalWidth - PCT_W - NAME_MIN - ML_GAP;
      const count = Math.max(7, Math.min(28, Math.floor((available + CELL_GAP) / (CELL_SIZE + CELL_GAP))));
      setDayCount(count);
    };
    calculate();
    const observer = new ResizeObserver(calculate);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const days = useMemo(() => {
    const arr: string[] = [];
    const now = new Date();
    for (let i = dayCount - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      arr.push(d.toISOString().split('T')[0]);
    }
    return arr;
  }, [dayCount]);

  const dayLabels = useMemo(() => days.map(d =>
    ['S','M','T','W','T','F','S'][new Date(d + 'T12:00:00').getDay()]
  ), [days]);

  return (
    <div ref={containerRef} className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 mb-6 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FaFire className="text-lg text-orange-500" />
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Habits</h2>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-zinc-400 dark:text-zinc-500 flex-wrap justify-end">
          <span className="flex items-center gap-0.5">
            <span>Low</span>
            <span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block ml-1" />
            <span className="w-2.5 h-2.5 rounded-sm bg-orange-400 inline-block" />
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 dark:bg-emerald-400 inline-block" />
            <span className="w-2.5 h-2.5 rounded-sm bg-green-500 dark:bg-green-400 inline-block" />
            <span className="ml-1">High</span>
          </span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400 inline-block" /> Today</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" /> Miss</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-zinc-200 dark:bg-zinc-700 inline-block" /> Rest</span>
        </div>
      </div>

      {/* Day labels — once */}
      <div className="flex items-center mb-1">
        <div className="flex-1 min-w-0" />
        <div className="flex gap-0.5 shrink-0">
          {dayLabels.map((label, i) => (
            <div key={i} className="w-3.5 text-[9px] text-zinc-400 dark:text-zinc-500 text-center">{label}</div>
          ))}
        </div>
        <div className="w-11 shrink-0" />
      </div>

      {/* Goal rows */}
      <div className="flex flex-col gap-px">
        {habitGoals.map(goal => (
          <HabitRow key={goal.id} goal={goal} completionDates={completionDates} today={today} days={days} />
        ))}
      </div>
    </div>
  );
}

type CellStatus =
  | { kind: 'hit'; pct: number }
  | { kind: 'today' }
  | { kind: 'off' }
  | { kind: 'missed' }
  | { kind: 'future' };

function HabitRow({ goal, completionDates, today, days }: { goal: OutcomeData; completionDates: Record<number, { date: string; value: number; completed: boolean }[]>; today: string; days: string[] }) {
  const scheduleDays: number[] = parseScheduleDays(goal.scheduleDays);
  const entries = completionDates[goal.id] || [];

  const { cells, adherence } = useMemo(() => {
    const dateValues = new Map<string, number>();
    const postponedSet = new Set<string>();
    for (const e of entries) {
      if (e.value === -1) {
        postponedSet.add(e.date);
      } else {
        dateValues.set(e.date, (dateValues.get(e.date) || 0) + e.value);
      }
    }

    const cellData: CellStatus[] = days.map(dateStr => {
      const d = new Date(dateStr + 'T12:00:00');
      const dow = d.getDay();
      const isScheduled = scheduleDays.length === 0 || scheduleDays.includes(dow);
      const isBeforeStart = goal.startDate && dateStr < goal.startDate;
      const isFuture = dateStr > today;

      if (isBeforeStart || isFuture) return { kind: 'future' };
      if (!isScheduled) return { kind: 'off' };
      if (dateValues.has(dateStr)) {
        const val = dateValues.get(dateStr) || 0;
        const pct = goal.dailyTarget && goal.completionType !== 'checkbox'
          ? Math.round((val / goal.dailyTarget) * 100)
          : 100;
        return { kind: 'hit', pct };
      }
      if (postponedSet.has(dateStr)) return { kind: 'off' };
      if (dateStr === today) return { kind: 'today' };
      return { kind: 'missed' };
    });

    // Adherence
    const adhStart = goal.startDate && goal.startDate <= today ? goal.startDate : today;
    let exp = 0;
    const iter = new Date(adhStart + 'T00:00:00');
    const endD = new Date(today + 'T00:00:00');
    while (iter <= endD) {
      if (scheduleDays.length === 0 || scheduleDays.includes(iter.getDay())) exp++;
      iter.setDate(iter.getDate() + 1);
    }
    let h = 0;
    if (!goal.dailyTarget || goal.completionType === 'checkbox') {
      const uniqueDone = new Set([...dateValues.keys()].filter(dd => dd >= adhStart && dd <= today));
      h = Math.min(uniqueDone.size, exp);
    } else {
      for (const [dd, val] of dateValues) {
        if (dd >= adhStart && dd <= today) h += Math.min(val / goal.dailyTarget, 1);
      }
      h = Math.min(h, exp);
    }
    const adh = exp > 0 ? Math.round((h / exp) * 100) : 0;

    return { cells: cellData, adherence: adh };
  }, [entries, today, days, goal.startDate, goal.dailyTarget, goal.completionType, scheduleDays]);

  const getCellClass = (cell: CellStatus) => {
    switch (cell.kind) {
      case 'hit':
        if (cell.pct >= 95) return 'bg-green-500 dark:bg-green-400';
        if (cell.pct >= 75) return 'bg-emerald-500 dark:bg-emerald-400';
        if (cell.pct >= 50) return 'bg-amber-400';
        if (cell.pct >= 25) return 'bg-orange-400';
        return 'bg-red-400';
      case 'today': return 'bg-blue-400 dark:bg-blue-500 ring-1 ring-blue-500/50';
      case 'missed': return 'bg-red-400 dark:bg-red-500/70';
      case 'off': return 'bg-zinc-200 dark:bg-zinc-700';
      case 'future': return 'bg-zinc-100 dark:bg-zinc-800 opacity-30';
    }
  };

  return (
    <Link href={`/goals/${goal.id}`} className="flex items-center hover:opacity-80 transition-opacity cursor-pointer leading-none py-px">
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        {goal.pillarEmoji && <span className="text-xs shrink-0">{goal.pillarEmoji}</span>}
        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">{goal.name}</span>
      </div>
      <div className="flex gap-0.5 shrink-0 ml-2">
        {cells.map((cell, i) => (
          <div key={i} className={`w-3.5 h-3.5 rounded-sm shrink-0 ${getCellClass(cell)}`} />
        ))}
      </div>
      <div className="w-11 shrink-0 text-right pl-1">
        <span className={`text-[11px] font-semibold ${
          adherence >= 95 ? 'text-green-500' :
          adherence >= 75 ? 'text-emerald-500' :
          adherence >= 50 ? 'text-amber-500' :
          adherence >= 25 ? 'text-orange-500' :
          'text-red-500'
        }`}>{adherence}%</span>
      </div>
    </Link>
  );
}
