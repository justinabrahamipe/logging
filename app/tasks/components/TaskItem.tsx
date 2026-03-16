"use client";

import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPlus, FaEdit, FaTrash, FaCheck, FaMinus, FaPlay, FaStop, FaEllipsisV, FaCopy, FaStar, FaTimes, FaArrowLeft, FaArrowRight } from "react-icons/fa";
import { DAY_NAMES } from "@/lib/constants";
import type { Task, Outcome, Cycle } from "@/lib/types";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

const DAYS_OF_WEEK = DAY_NAMES;

export interface EnrichedTask extends Task {
  _pillarColor: string;
  _pillarEmoji: string;
  _pillarName: string;
}

interface TaskItemProps {
  task: EnrichedTask;
  showDate?: string;
  goalsList: Outcome[];
  cycles: Cycle[];
  maxStarsReached: boolean;
  timers: Record<number, { running: boolean; elapsed: number; interval?: NodeJS.Timeout }>;
  pendingValues: Record<number, string>;
  setPendingValues: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  openMenuId: number | null;
  setOpenMenuId: React.Dispatch<React.SetStateAction<number | null>>;
  actionLoading: Record<number, boolean>;
  menuRef: React.RefObject<HTMLDivElement | null>;
  router: AppRouterInstance;
  // Handlers
  handleCheckboxToggle: (task: Task) => void;
  handleCountChange: (task: Task, delta: number) => void;
  handleNumericSubmit: (task: Task) => void;
  handleTimerToggle: (task: Task) => void;
  handleDurationManualSubmit: (task: Task) => void;
  handleHighlightToggle: (taskId: number) => void;
  handleCopy: (task: Task) => void;
  handleDelete: (id: number) => void;
  handleDiscard: (task: Task) => void;
  handleMoveDate: (task: Task, direction: -1 | 1) => void;
  formatTime: (seconds: number) => string;
}

export default function TaskItem({
  task,
  showDate,
  goalsList,
  cycles,
  maxStarsReached,
  timers,
  pendingValues,
  setPendingValues,
  openMenuId,
  setOpenMenuId,
  actionLoading,
  menuRef,
  router,
  handleCheckboxToggle,
  handleCountChange,
  handleNumericSubmit,
  handleTimerToggle,
  handleDurationManualSubmit,
  handleHighlightToggle,
  handleCopy,
  handleDelete,
  handleDiscard,
  handleMoveDate,
  formatTime,
}: TaskItemProps) {
  const isCompleted = task.completion?.completed || false;
  const currentValue = task.completion?.value || 0;
  const isDiscarded = isCompleted && task.completionType === 'checkbox' && currentValue === 0;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuAbove, setMenuAbove] = useState(false);

  useEffect(() => {
    if (openMenuId === task.id && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setMenuAbove(spaceBelow < 220);
    }
  }, [openMenuId, task.id]);
  const isFullyDone = !isDiscarded && (isCompleted || (task.target != null && task.target > 0 && currentValue >= task.target));
  const isHighlighted = task.completion?.isHighlighted || false;
  const isTaskLoading = actionLoading[task.id] || false;

  return (
    <div
      key={task.id}
      className={`rounded-lg px-3 py-2.5 transition-all ${
        isDiscarded
          ? 'bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-300 dark:border-zinc-600 opacity-60'
          : isFullyDone
          ? 'bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800'
          : isHighlighted
          ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 hover:shadow-md'
          : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-600'
      } ${isTaskLoading ? 'opacity-60' : ''}`}
      style={{ borderLeftWidth: 3, borderLeftColor: isDiscarded ? '#9CA3AF' : isFullyDone ? '#4ade80' : isHighlighted ? '#F59E0B' : task._pillarColor }}
    >
      <div className="flex items-center gap-2">
        {/* Left: star + name, pillar, badges */}
        {(isHighlighted || !maxStarsReached) && (
          <button
            onClick={() => handleHighlightToggle(task.id)}
            className={`shrink-0 transition-colors ${
              isHighlighted
                ? 'text-amber-500'
                : 'text-zinc-300 dark:text-zinc-600 hover:text-amber-400'
            }`}
            title={isHighlighted ? 'Remove highlight' : 'Highlight task (max 3/day)'}
          >
            <FaStar className="text-xs" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-semibold leading-snug ${isDiscarded ? 'line-through text-zinc-400 dark:text-zinc-500 italic' : isFullyDone ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-zinc-900 dark:text-white'}`}>
            {task.name}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0">{task._pillarEmoji} {task._pillarName}</span>
            {task.goalId && goalsList.find(o => o.id === task.goalId) && (
              <span className="text-[11px] px-1.5 py-px rounded-full font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 truncate max-w-[120px]">
                {goalsList.find(o => o.id === task.goalId)?.name}
              </span>
            )}
            {task.periodId && cycles.find(c => c.id === task.periodId) && (
              <span className="text-[11px] px-1.5 py-px rounded-full font-medium bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 truncate max-w-[120px]">
                {cycles.find(c => c.id === task.periodId)?.name}
              </span>
            )}
            {showDate && (
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{showDate}</span>
            )}
          </div>
          {task.frequency !== 'daily' && task.frequency !== 'adhoc' && (
            <div className="mt-0.5">
              <span className="text-[11px] px-1.5 py-px rounded-full font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                {task.frequency === 'monthly' ? `Monthly` :
                 task.frequency === 'custom' ? (task.customDays ? JSON.parse(task.customDays).map((d: number) => DAYS_OF_WEEK[d]).join(', ') : 'Custom') :
                 task.frequency === 'interval' ? `Every ${(task as unknown as Record<string, unknown>).repeatInterval || '?'} days` :
                 task.frequency}
              </span>
            </div>
          )}
        </div>

        {/* Right: completion controls + menu */}
        <div className="flex items-center gap-1.5 shrink-0">
          <>
            {task.completionType === 'checkbox' && (
              <button
                onClick={() => handleCheckboxToggle(task)}
                className={`w-7 h-7 rounded-md border-2 flex items-center justify-center transition-colors ${
                  isCompleted
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-zinc-300 dark:border-zinc-600 hover:border-green-500'
                }`}
              >
                {isCompleted && <FaCheck className="text-xs" />}
              </button>
            )}

            {task.completionType === 'count' && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleCountChange(task, -1)}
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
                  onClick={() => handleCountChange(task, 1)}
                  className="w-6 h-6 rounded bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center hover:bg-zinc-800 dark:hover:bg-zinc-100"
                >
                  <FaPlus className="text-[9px]" />
                </button>
              </div>
            )}

            {task.completionType === 'duration' && (
              <div className="flex items-center gap-1">
                {timers[task.id]?.running ? (
                  <span className="text-xs font-mono text-zinc-700 dark:text-zinc-300 w-12 text-center">
                    {formatTime(timers[task.id].elapsed)}
                  </span>
                ) : (
                  <>
                    <input
                      type="number"
                      value={pendingValues[task.id] ?? (currentValue || '')}
                      onChange={(e) => setPendingValues(prev => ({ ...prev, [task.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && handleDurationManualSubmit(task)}
                      placeholder="0"
                      className="w-12 px-1.5 py-1 text-xs text-right border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                    />
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">m</span>
                    {pendingValues[task.id] !== undefined && (
                      <button
                        onClick={() => handleDurationManualSubmit(task)}
                        className="w-6 h-6 rounded bg-green-500 text-white flex items-center justify-center hover:bg-green-600"
                      >
                        <FaCheck className="text-[9px]" />
                      </button>
                    )}
                  </>
                )}
                <button
                  onClick={() => handleTimerToggle(task)}
                  className={`w-6 h-6 rounded flex items-center justify-center ${
                    timers[task.id]?.running
                      ? 'bg-red-500 text-white'
                      : 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                  }`}
                >
                  {timers[task.id]?.running ? <FaStop className="text-[9px]" /> : <FaPlay className="text-[9px]" />}
                </button>
              </div>
            )}

            {task.completionType === 'numeric' && (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={pendingValues[task.id] ?? (currentValue || '')}
                  onChange={(e) => setPendingValues(prev => ({ ...prev, [task.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleNumericSubmit(task)}
                  placeholder={task.target ? String(task.target) : '0'}
                  className="w-14 px-1.5 py-1 text-xs text-right border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                />
                {pendingValues[task.id] !== undefined && (
                  <button
                    onClick={() => handleNumericSubmit(task)}
                    className="w-6 h-6 rounded bg-green-500 text-white flex items-center justify-center hover:bg-green-600"
                  >
                    <FaCheck className="text-[9px]" />
                  </button>
                )}
              </div>
            )}
          </>

          <div className="relative" ref={openMenuId === task.id ? menuRef : undefined}>
            <button
              ref={buttonRef}
              onClick={() => setOpenMenuId(openMenuId === task.id ? null : task.id)}
              className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700"
            >
              <FaEllipsisV className="text-[10px]" />
            </button>
            <AnimatePresence>
              {openMenuId === task.id && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.1 }}
                  className={`absolute right-0 z-20 w-36 bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden ${menuAbove ? 'bottom-7' : 'top-7'}`}
                >
                  <button
                    onClick={() => { setOpenMenuId(null); router.push(`/tasks/${task.id}/edit`); }}
                    className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  >
                    <FaEdit className="text-xs" /> Edit
                  </button>
                  {task.startDate && (
                    <>
                      <button
                        onClick={() => handleMoveDate(task, -1)}
                        className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                      >
                        <FaArrowLeft className="text-xs" /> Move Back
                      </button>
                      <button
                        onClick={() => handleMoveDate(task, 1)}
                        className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                      >
                        <FaArrowRight className="text-xs" /> Move Forward
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleCopy(task)}
                    className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  >
                    <FaCopy className="text-xs" /> Duplicate
                  </button>
                  <button
                    onClick={() => handleDiscard(task)}
                    className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-zinc-500 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  >
                    <FaTimes className="text-xs" /> Discard
                  </button>
                  <button
                    onClick={() => { setOpenMenuId(null); handleDelete(task.id); }}
                    className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <FaTrash className="text-xs" /> Delete
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
