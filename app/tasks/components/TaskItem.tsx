"use client";

import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPlus, FaEdit, FaTrash, FaCheck, FaMinus, FaPlay, FaPause, FaStop, FaEllipsisV, FaCopy, FaStar, FaTimes, FaArrowLeft, FaArrowRight } from "react-icons/fa";
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
  handleMarkDone?: (task: Task) => void;
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
  handleMarkDone,
  formatTime,
}: TaskItemProps) {
  const isCompleted = task.completion?.completed || false;
  const currentValue = task.completion?.value || 0;
  const isDiscarded = isCompleted && task.completionType === 'checkbox' && currentValue === 0;
  const isLimitTask = task.flexibilityRule === 'limit_avoid';
  const limitVal = task.limitValue ?? task.target ?? 0;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [menuPos, setMenuPos] = useState<{ top?: number; bottom?: number; right: number }>({ right: 0 });

  // Swipe state
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [touching, setTouching] = useState(false);
  const swipeLocked = useRef(false);
  const isHorizontalSwipe = useRef(false);

  useEffect(() => {
    if (openMenuId === task.id && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const right = window.innerWidth - rect.right;
      if (spaceBelow < 220) {
        setMenuPos({ bottom: window.innerHeight - rect.top + 4, right });
      } else {
        setMenuPos({ top: rect.bottom + 4, right });
      }
    }
  }, [openMenuId, task.id]);
  const isFullyDone = !isDiscarded && (
    isLimitTask
      ? isCompleted
      : (isCompleted || (task.target != null && task.target > 0 && currentValue >= task.target))
  );
  const isOverLimit = isLimitTask && limitVal > 0 && currentValue > limitVal;
  const isHighlighted = task.completion?.isHighlighted || false;
  const isTaskLoading = actionLoading[task.id] || false;

  // Calculate progress percentage for the fill effect
  const progressPct = (() => {
    if (isDiscarded) return 0;
    if (task.completionType === 'checkbox') return isCompleted ? 100 : 0;
    const target = isLimitTask ? limitVal : (task.target || 0);
    if (target <= 0) return currentValue > 0 ? 100 : 0;
    return Math.min((currentValue / target) * 100, 100);
  })();
  const progressColor = isOverLimit ? '#ef4444' : progressPct >= 100 ? '#22C55E' : progressPct > 0 ? '#F59E0B' : 'transparent';

  const swipeThreshold = typeof window !== 'undefined' ? window.innerWidth * 0.3 : 120;
  const canSwipe = !isTaskLoading;

  const handleTouchStart = (e: React.TouchEvent) => {
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    touchStartX.current = touchX;
    touchStartY.current = touchY;
    swipeLocked.current = false;
    isHorizontalSwipe.current = false;
    if (canSwipe) setTouching(true);
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      setTouching(false);
      setOpenMenuId(task.id);
      // Position menu near touch point
      const right = Math.max(8, window.innerWidth - touchX - 70);
      const spaceBelow = window.innerHeight - touchY;
      if (spaceBelow < 220) {
        setMenuPos({ bottom: window.innerHeight - touchY + 4, right });
      } else {
        setMenuPos({ top: touchY + 4, right });
      }
    }, 500);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    if (!swipeLocked.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      swipeLocked.current = true;
      isHorizontalSwipe.current = canSwipe && Math.abs(dx) > Math.abs(dy);
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }

    if (isHorizontalSwipe.current) {
      e.preventDefault();
      const wasPast = Math.abs(swipeX) >= swipeThreshold;
      const isPast = Math.abs(dx) >= swipeThreshold;
      // Haptic feedback when crossing threshold
      if (isPast && !wasPast && navigator.vibrate) {
        navigator.vibrate(15);
      }
      setSwiping(true);
      setSwipeX(dx);
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setTouching(false);
    if (swiping) {
      if (swipeX > swipeThreshold) {
        handleSwipeRight();
      } else if (swipeX < -swipeThreshold) {
        handleSwipeLeft();
      }
      setSwiping(false);
      setSwipeX(0);
    }
  };

  // Compute 10% increment for non-checkbox tasks (min 1)
  const isNonCheckbox = task.completionType !== 'checkbox';
  const swipeIncrement = isNonCheckbox
    ? Math.max(1, Math.round((isLimitTask ? limitVal : (task.target || 10)) * 0.1))
    : 0;
  const isTimerRunning = task.completionType === 'duration' && timers[task.id]?.running;

  // For non-checkbox: will a left swipe discard (value at 0) or decrement?
  const isAtZero = isNonCheckbox && currentValue <= 0;

  const handleSwipeRight = () => {
    if (isDiscarded) {
      // Discarded → mark as done (undiscard + complete)
      handleCheckboxToggle(task);
    } else if (task.completionType === 'checkbox' || isFullyDone) {
      handleCheckboxToggle(task);
    } else if (!isTimerRunning) {
      handleCountChange(task, swipeIncrement);
    }
  };

  const handleSwipeLeft = () => {
    if (isDiscarded) {
      // Discarded → undiscard (back to pending)
      handleCheckboxToggle(task);
    } else if (task.completionType === 'checkbox') {
      if (isFullyDone) handleCheckboxToggle(task);
      else handleDiscard(task);
    } else if (isFullyDone || isAtZero) {
      handleDiscard(task);
    } else if (!isTimerRunning) {
      handleCountChange(task, -swipeIncrement);
    }
  };

  // Swipe visual feedback — progress as % of threshold
  const swipeProgress = Math.min(Math.abs(swipeX) / swipeThreshold, 1);
  const pastThreshold = swipeProgress >= 1;

  // Context-aware labels and colors
  const showIncrement = isNonCheckbox && !isFullyDone && !isDiscarded && !isTimerRunning;
  const rightLabel = isDiscarded ? 'Done' : showIncrement ? `+${swipeIncrement}` : isFullyDone ? 'Undo' : 'Done';
  const leftLabel = isDiscarded ? 'Undiscard' : (showIncrement && !isAtZero ? `-${swipeIncrement}` : (isFullyDone ? 'Undo' : 'Discard'));
  const rightColor = isDiscarded ? 'green' : showIncrement ? 'green' : (isFullyDone ? 'amber' : 'green');
  const leftColor = isDiscarded ? 'amber' : (showIncrement && !isAtZero ? 'amber' : 'red');

  return (
    <div className="relative rounded-lg overflow-hidden">
      {/* Swipe hint labels on touch */}
      {touching && !swiping && canSwipe && (
        <div className="absolute inset-0 flex items-center justify-between px-3 pointer-events-none rounded-lg">
          <span className={`text-[10px] font-medium opacity-60 ${rightColor === 'green' ? 'text-green-500 dark:text-green-400' : 'text-amber-500 dark:text-amber-400'}`}>{rightLabel}</span>
          {leftLabel && (
            <span className={`text-[10px] font-medium opacity-60 ${leftColor === 'red' ? 'text-red-500 dark:text-red-400' : 'text-amber-500 dark:text-amber-400'}`}>{leftLabel}</span>
          )}
        </div>
      )}
      {/* Swipe reveal background */}
      {swiping && swipeX !== 0 && (() => {
        const isRight = swipeX > 0;
        const color = isRight ? rightColor : leftColor;
        const bgClass = pastThreshold
          ? (color === 'green' ? 'bg-green-500' : color === 'red' ? 'bg-red-500' : 'bg-amber-500')
          : (color === 'green' ? 'bg-green-400/70' : color === 'red' ? 'bg-red-400/70' : 'bg-amber-400/70');
        const icon = isRight
          ? (showIncrement ? <FaPlus /> : <FaCheck />)
          : (showIncrement && !isAtZero ? <FaMinus /> : <FaTimes />);

        return (
          <div className={`absolute inset-0 ${bgClass} flex items-center ${isRight ? 'justify-start pl-5' : 'justify-end pr-5'} rounded-lg`}>
            <span className="text-white font-bold" style={{ opacity: swipeProgress, fontSize: pastThreshold ? 16 : 12, transition: 'font-size 0.1s' }}>
              {icon}
            </span>
          </div>
        );
      })()}
      <div
        key={task.id}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        className={`relative rounded-lg px-3 py-2.5 overflow-hidden transition-all ${
          isDiscarded
            ? 'bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 opacity-60'
            : isOverLimit
            ? 'bg-white dark:bg-zinc-800 border border-red-200 dark:border-red-800'
            : isFullyDone
            ? 'bg-white dark:bg-zinc-800 border border-green-200 dark:border-green-800'
            : isHighlighted
            ? 'bg-amber-50 dark:bg-zinc-800 border border-amber-200 dark:border-amber-800 hover:shadow-md'
            : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-600'
        }`}
        style={{
          borderLeftWidth: 3,
          borderLeftColor: isDiscarded ? '#9CA3AF' : isOverLimit ? '#ef4444' : isFullyDone ? '#4ade80' : isHighlighted ? '#F59E0B' : task._pillarColor,
          transform: swiping ? `translateX(${swipeX * 0.3}px)` : undefined,
          transition: swiping ? 'none' : 'transform 0.2s ease-out',
        }}
      >
      {progressPct > 0 && (
        <div
          className="absolute inset-0 opacity-10 dark:opacity-15 pointer-events-none"
          style={{ background: progressColor, width: `${progressPct}%` }}
        />
      )}
      {isTaskLoading && (
        <div className="absolute inset-0 bg-white/50 dark:bg-zinc-800/50 flex items-center justify-center z-10 rounded-lg">
          <div className="w-4 h-4 border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-600 dark:border-t-zinc-300 rounded-full animate-spin" />
        </div>
      )}
      <div className="relative flex items-center gap-2">
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
          <h3 className={`text-sm font-semibold leading-snug truncate ${isDiscarded ? 'line-through text-zinc-400 dark:text-zinc-500 italic' : isFullyDone ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-zinc-900 dark:text-white'}`}>
            {task.name}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0">{task._pillarEmoji} {task._pillarName}</span>
            {isLimitTask && task.completionType !== 'checkbox' && (
              <span title="Limit" className="text-[10px] w-4 h-4 rounded-full font-bold inline-flex items-center justify-center bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                L
              </span>
            )}
            {!isLimitTask && task.completionType !== 'checkbox' && task.target != null && task.target > 0 && (
              <span title="Target" className="text-[10px] w-4 h-4 rounded-full font-bold inline-flex items-center justify-center bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                T
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
                  isLimitTask
                    ? (currentValue > limitVal ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400')
                    : (task.target && currentValue >= task.target ? 'text-green-600 dark:text-green-400' : 'text-zinc-900 dark:text-white')
                }`}>
                  {currentValue}/{isLimitTask ? limitVal : (task.target || '?')}
                </span>
                <button
                  onClick={() => handleCountChange(task, 1)}
                  className="w-6 h-6 rounded bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center hover:bg-zinc-800 dark:hover:bg-zinc-100"
                >
                  <FaPlus className="text-[9px]" />
                </button>
              </div>
            )}

            {task.completionType === 'duration' && (() => {
              const timer = timers[task.id];
              const elapsed = timer ? timer.elapsed : (currentValue * 60);
              const targetSec = (task.target || 0) * 60;
              const limitSec = isLimitTask ? (limitVal * 60) : 0;
              const isRunning = timer?.running || false;
              const done = isLimitTask ? false : (targetSec > 0 && elapsed >= targetSec);
              const isEditing = pendingValues[task.id] !== undefined;
              const targetDisplay = task.target ? `${task.target}:00` : null;
              return (
                <div className="flex items-center gap-1">
                  {!isRunning && isEditing ? (
                    <input
                      type="number"
                      value={pendingValues[task.id]}
                      onChange={(e) => setPendingValues(prev => ({ ...prev, [task.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && handleDurationManualSubmit(task)}
                      onBlur={() => handleDurationManualSubmit(task)}
                      autoFocus
                      placeholder="0"
                      className="w-10 px-1 py-0.5 text-xs text-right border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white font-mono"
                    />
                  ) : (
                    <button
                      onClick={() => { if (!isRunning) setPendingValues(prev => ({ ...prev, [task.id]: String(Math.round(elapsed / 60)) })); }}
                      className={`text-xs font-mono min-w-[3rem] text-center ${
                        isLimitTask && limitSec > 0 && elapsed > limitSec ? 'text-red-600 dark:text-red-400 font-bold' :
                        done ? 'text-green-600 dark:text-green-400 font-bold' :
                        isRunning ? 'text-zinc-900 dark:text-white font-bold' :
                        'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white cursor-text'
                      }`}
                      disabled={isRunning}
                    >
                      {isLimitTask && limitSec > 0
                        ? formatTime(Math.max(0, limitSec - elapsed))
                        : formatTime(elapsed)}
                      {targetDisplay ? <span className="text-zinc-400 dark:text-zinc-500 font-normal">/{targetDisplay}</span> : null}
                    </button>
                  )}
                  <button
                    onClick={() => isEditing ? handleDurationManualSubmit(task) : handleTimerToggle(task)}
                    className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                      isEditing
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : isRunning
                        ? 'bg-amber-500 text-white hover:bg-amber-600'
                        : 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100'
                    }`}
                  >
                    {isEditing ? <FaCheck className="text-[9px]" /> : isRunning ? <FaPause className="text-[9px]" /> : <FaPlay className="text-[9px]" />}
                  </button>
                </div>
              );
            })()}

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
                <>
                <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.1 }}
                  className="fixed z-50 w-36 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden"
                  style={{ right: menuPos.right, ...(menuPos.top != null ? { top: menuPos.top } : { bottom: menuPos.bottom }) }}
                >
                  {isLimitTask && !isCompleted && handleMarkDone && (
                    <button
                      onClick={() => { setOpenMenuId(null); handleMarkDone(task); }}
                      className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                    >
                      <FaCheck className="text-xs" /> Mark as Done
                    </button>
                  )}
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
                        <FaArrowLeft className="text-xs" /> Prepone
                      </button>
                      <button
                        onClick={() => handleMoveDate(task, 1)}
                        className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                      >
                        <FaArrowRight className="text-xs" /> Postpone
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleCopy(task)}
                    className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  >
                    <FaCopy className="text-xs" /> Duplicate
                  </button>
                  {isDiscarded ? (
                    <button
                      onClick={() => { setOpenMenuId(null); handleCheckboxToggle(task); }}
                      className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                    >
                      <FaCheck className="text-xs" /> Undiscard
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDiscard(task)}
                      className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-zinc-500 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    >
                      <FaTimes className="text-xs" /> Discard
                    </button>
                  )}
                  <button
                    onClick={() => { setOpenMenuId(null); handleDelete(task.id); }}
                    className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <FaTrash className="text-xs" /> Delete
                  </button>
                </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
