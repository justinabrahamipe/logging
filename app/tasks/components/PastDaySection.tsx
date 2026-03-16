"use client";

import { FaPlus, FaCheck, FaMinus, FaChevronDown, FaStar } from "react-icons/fa";
import { formatDate } from "@/lib/format";
import type { PastDay } from "../hooks/useTasksPage";

type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" | "DD-MM-YYYY" | "MM-DD-YYYY";

interface PastDaySectionProps {
  day: PastDay;
  dateFormat: DateFormat;
  openSchedules: Set<string>;
  setOpenSchedules: React.Dispatch<React.SetStateAction<Set<string>>>;
  pastPending: Record<string, string>;
  setPastPending: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handlePastComplete: (date: string, taskId: number, completed: boolean, value?: number) => void;
  handlePastCountChange: (date: string, task: { id: number; target: number | null; completed: boolean; value: number | null }, delta: number) => void;
  handlePastNumericSubmit: (date: string, task: { id: number; target: number | null }) => void;
}

export default function PastDaySection({
  day,
  dateFormat,
  openSchedules,
  setOpenSchedules,
  pastPending,
  setPastPending,
  handlePastComplete,
  handlePastCountChange,
  handlePastNumericSubmit,
}: PastDaySectionProps) {
  const dateLabel = formatDate(day.date, dateFormat);
  const completedCount = day.tasks.filter(t => t.completed || (t.target && t.target > 0 && (t.value || 0) >= t.target)).length;
  const dayKey = `past-${day.date}`;
  const isOpen = openSchedules.has(dayKey);

  return (
    <div key={day.date}>
      <button
        onClick={() => setOpenSchedules(prev => {
          const next = new Set(prev);
          if (next.has(dayKey)) next.delete(dayKey); else next.add(dayKey);
          return next;
        })}
        className="w-full px-3 py-2 flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
      >
        <FaChevronDown className={`text-[10px] text-zinc-400 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
        <span>{dateLabel}</span>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">{completedCount}/{day.tasks.length}</span>
      </button>
      {isOpen && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.5rem' }}>
          {day.tasks.map(task => {
            const currentValue = task.value || 0;
            const isDone = task.completed || (task.target != null && task.target > 0 && currentValue >= task.target);
            const pendingKey = `${day.date}-${task.id}`;
            return (
              <div
                key={pendingKey}
                className={`rounded-lg px-3 py-2.5 transition-all ${
                  isDone
                    ? 'bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800'
                    : task.isHighlighted
                    ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800'
                    : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700'
                }`}
                style={{ borderLeftWidth: 3, borderLeftColor: isDone ? '#4ade80' : task.isHighlighted ? '#F59E0B' : (task.pillarColor || '#6B7280') }}
              >
                <div className="flex items-center gap-2">
                  {task.isHighlighted && <FaStar className="text-xs text-amber-500 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-semibold leading-snug ${isDone ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-zinc-900 dark:text-white'}`}>
                      {task.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      {task.pillarEmoji && (
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{task.pillarEmoji} {task.pillarName}</span>
                      )}
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{formatDate(day.date, dateFormat)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {task.completionType === 'checkbox' && (
                      <button
                        onClick={() => handlePastComplete(day.date, task.id, !isDone)}
                        className={`w-7 h-7 rounded-md border-2 flex items-center justify-center transition-colors ${
                          isDone
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-zinc-300 dark:border-zinc-600 hover:border-green-500'
                        }`}
                      >
                        {isDone && <FaCheck className="text-xs" />}
                      </button>
                    )}
                    {task.completionType === 'count' && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handlePastCountChange(day.date, task, -1)}
                          className="w-6 h-6 rounded bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center hover:bg-zinc-300 dark:hover:bg-zinc-600"
                        >
                          <FaMinus className="text-[9px]" />
                        </button>
                        <span className={`text-xs font-bold min-w-[2.5rem] text-center ${
                          task.target && currentValue >= task.target ? 'text-green-600 dark:text-green-400' : 'text-zinc-900 dark:text-white'
                        }`}>
                          {currentValue}/{task.target || '?'}
                        </span>
                        <button
                          onClick={() => handlePastCountChange(day.date, task, 1)}
                          className="w-6 h-6 rounded bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center hover:bg-zinc-800 dark:hover:bg-zinc-100"
                        >
                          <FaPlus className="text-[9px]" />
                        </button>
                      </div>
                    )}
                    {(task.completionType === 'numeric' || task.completionType === 'duration') && (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={pastPending[pendingKey] ?? (currentValue || '')}
                          onChange={(e) => setPastPending(prev => ({ ...prev, [pendingKey]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && handlePastNumericSubmit(day.date, task)}
                          placeholder={task.target ? String(task.target) : '0'}
                          className="w-14 px-1.5 py-1 text-xs text-right border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                        />
                        {task.completionType === 'duration' && <span className="text-[10px] text-zinc-500 dark:text-zinc-400">m</span>}
                        {pastPending[pendingKey] !== undefined && (
                          <button
                            onClick={() => handlePastNumericSubmit(day.date, task)}
                            className="w-6 h-6 rounded bg-green-500 text-white flex items-center justify-center hover:bg-green-600"
                          >
                            <FaCheck className="text-[9px]" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
