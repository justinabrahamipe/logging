"use client";

import { motion } from "framer-motion";
import { FaPlus, FaCheck, FaChevronDown, FaTimes } from "react-icons/fa";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import type { Pillar, Outcome } from "@/lib/types";
import type { TaskFilters, ScoreSummary } from "../hooks/useTasksPage";

interface DateNavigationProps {
  filters: TaskFilters;
  setFilters: React.Dispatch<React.SetStateAction<TaskFilters>>;
  activePopover: null | 'add' | 'date' | 'status' | 'pillar' | 'goal';
  setActivePopover: React.Dispatch<React.SetStateAction<null | 'add' | 'date' | 'status' | 'pillar' | 'goal'>>;
  datePickerMode: null | 'single' | 'range';
  setDatePickerMode: React.Dispatch<React.SetStateAction<null | 'single' | 'range'>>;
  pendingRange: { from: Date; to?: Date } | undefined;
  setPendingRange: React.Dispatch<React.SetStateAction<{ from: Date; to?: Date } | undefined>>;
  scoreSummary: ScoreSummary | null;
  refreshing: boolean;
  pillars: Pillar[];
  goalsList: Outcome[];
  getDateLabel: () => string;
  closePopover: () => void;
}

export default function DateNavigation({
  filters,
  setFilters,
  activePopover,
  setActivePopover,
  datePickerMode,
  setDatePickerMode,
  pendingRange,
  setPendingRange,
  scoreSummary,
  refreshing,
  pillars,
  goalsList,
  getDateLabel,
  closePopover,
}: DateNavigationProps) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white">Tasks</h1>
        {scoreSummary && filters.date.type !== 'scheduled' && (
          <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            {scoreSummary.totalTasks > 0 ? Math.round((scoreSummary.completedTasks / scoreSummary.totalTasks) * 100) : 0}%
            <span className="font-normal ml-1">{scoreSummary.completedTasks}/{scoreSummary.totalTasks}</span>
          </span>
        )}

        {/* Filter chips - inline with heading */}
        {activePopover && (
          <div className="fixed inset-0 z-40" onClick={closePopover} />
        )}
        <div className="flex flex-wrap items-center gap-1.5 ml-auto relative z-50">
          {/* Date chip */}
          <div className="relative">
            <button
              onClick={() => { setActivePopover(activePopover === 'date' ? null : 'date'); setDatePickerMode(null); setPendingRange(undefined); }}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-500 transition-colors"
            >
              {getDateLabel()}
              <FaChevronDown className="text-[8px] text-zinc-400" />
            </button>
            {activePopover === 'date' && (
              <div className="fixed sm:absolute bottom-4 sm:bottom-auto top-auto sm:top-full left-4 right-4 sm:left-auto sm:right-0 mt-1 z-50 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg p-1.5 min-w-[200px] max-w-[calc(100vw-2rem)] max-h-[80vh] overflow-y-auto">
                {!datePickerMode ? (
                  <div className="space-y-0.5">
                    {(['yesterday', 'today', 'tomorrow', 'week', 'month', 'no-date'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => { setFilters(f => ({ ...f, date: { type } })); setActivePopover(null); }}
                        className={`w-full px-3 py-1.5 text-left text-sm rounded-lg transition-colors ${
                          filters.date.type === type ? 'bg-zinc-100 dark:bg-zinc-700 font-medium text-zinc-900 dark:text-white' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        {type === 'yesterday' ? 'Yesterday' : type === 'today' ? 'Today' : type === 'tomorrow' ? 'Tomorrow' : type === 'week' ? 'This Week' : type === 'month' ? 'This Month' : 'No Date'}
                      </button>
                    ))}
                    <div className="border-t border-zinc-100 dark:border-zinc-700 my-1" />
                    <button
                      onClick={() => { setFilters(f => ({ ...f, date: { type: 'scheduled' } })); setActivePopover(null); }}
                      className={`w-full px-3 py-1.5 text-left text-sm rounded-lg transition-colors ${
                        filters.date.type === 'scheduled' ? 'bg-zinc-100 dark:bg-zinc-700 font-medium text-zinc-900 dark:text-white' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      Scheduled
                    </button>
                    <div className="border-t border-zinc-100 dark:border-zinc-700 my-1" />
                    <button
                      onClick={() => { setDatePickerMode('single'); setPendingRange(undefined); }}
                      className={`w-full px-3 py-1.5 text-left text-sm rounded-lg transition-colors ${
                        (filters.date.type === 'single' || filters.date.type === 'range') ? 'bg-zinc-100 dark:bg-zinc-700 font-medium text-zinc-900 dark:text-white' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      Custom
                    </button>
                  </div>
                ) : (
                  <div>
                    <button
                      onClick={() => { setDatePickerMode(null); setPendingRange(undefined); }}
                      className="px-2 py-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 mb-1"
                    >
                      &larr; Back
                    </button>
                    <p className="px-2 text-[11px] text-zinc-400 dark:text-zinc-500 mb-1">Pick a date or select a range (max 7 days)</p>
                    <style>{`
                      [data-date-picker] {
                        color: #18181b !important;
                        --rdp-accent-color: #18181b !important;
                        --rdp-accent-background-color: #fff !important;
                      }
                      [data-date-picker] .rdp-chevron { fill: currentColor !important; }
                      [data-date-picker] .rdp-day_button { color: inherit !important; border: none !important; outline: none !important; }
                      [data-date-picker] .rdp-selected { outline: none !important; border: none !important; }
                      [data-date-picker] .rdp-selected .rdp-day_button {
                        background: #fff !important; color: #18181b !important; font-weight: 600;
                        border: none !important; outline: none !important;
                      }
                      [data-date-picker] .rdp-range_start.rdp-range_end .rdp-day_button {
                        border-radius: 9999px !important;
                        border: 1.5px solid #a1a1aa !important; outline: none !important;
                      }
                      [data-date-picker] .rdp-range_start:not(.rdp-range_end) .rdp-day_button,
                      [data-date-picker] .rdp-range_end:not(.rdp-range_start) .rdp-day_button {
                        border: none !important;
                      }
                      [data-date-picker] .rdp-range_start {
                        background: #fff !important;
                        border-radius: 9999px 0 0 9999px !important;
                      }
                      [data-date-picker] .rdp-range_end {
                        background: #fff !important;
                        border-radius: 0 9999px 9999px 0 !important;
                      }
                      [data-date-picker] .rdp-range_start.rdp-range_end {
                        border-radius: 9999px !important;
                      }
                      [data-date-picker] .rdp-range_middle,
                      [data-date-picker] .rdp-selected:not(.rdp-range_start):not(.rdp-range_end):not(.rdp-range_middle) {
                        background: #fff !important;
                      }
                      [data-date-picker] .rdp-today:not(.rdp-selected) .rdp-day_button {
                        background: #dbeafe !important; border-radius: 9999px; font-weight: 600;
                      }
                      .dark [data-date-picker] .rdp-today:not(.rdp-selected) .rdp-day_button {
                        background: #1e3a5f !important; border-radius: 9999px; font-weight: 600; color: #fff !important;
                      }
                      .dark [data-date-picker] {
                        color: #e4e4e7 !important;
                        --rdp-accent-color: #fff !important;
                        --rdp-accent-background-color: #3f3f46 !important;
                      }
                      .dark [data-date-picker] .rdp-selected { outline: none !important; border: none !important; }
                      .dark [data-date-picker] .rdp-selected .rdp-day_button {
                        background: #3f3f46 !important; color: #fff !important; font-weight: 600;
                        border: none !important; outline: none !important;
                      }
                      .dark [data-date-picker] .rdp-range_start.rdp-range_end .rdp-day_button {
                        border-radius: 9999px !important;
                        border: 1.5px solid #71717a !important; outline: none !important;
                      }
                      .dark [data-date-picker] .rdp-range_start:not(.rdp-range_end) .rdp-day_button,
                      .dark [data-date-picker] .rdp-range_end:not(.rdp-range_start) .rdp-day_button {
                        border: none !important;
                      }
                      .dark [data-date-picker] .rdp-range_start {
                        background: #3f3f46 !important;
                        border-radius: 9999px 0 0 9999px !important;
                      }
                      .dark [data-date-picker] .rdp-range_end {
                        background: #3f3f46 !important;
                        border-radius: 0 9999px 9999px 0 !important;
                      }
                      .dark [data-date-picker] .rdp-range_start.rdp-range_end {
                        border-radius: 9999px !important;
                      }
                      .dark [data-date-picker] .rdp-range_middle,
                      .dark [data-date-picker] .rdp-selected:not(.rdp-range_start):not(.rdp-range_end):not(.rdp-range_middle) {
                        background: #3f3f46 !important;
                      }
                    `}</style>
                    <div data-date-picker>
                      <DayPicker
                        mode="range"
                        min={0}
                        max={7}
                        disabled={pendingRange?.from && !pendingRange?.to ? (date: Date) => {
                          const diffMs = date.getTime() - pendingRange.from.getTime();
                          const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
                          return diffDays > 7 || diffDays < -7;
                        } : undefined}
                        selected={pendingRange ?? (filters.date.type === 'range' && filters.date.value && filters.date.endDate
                          ? { from: new Date(filters.date.value + 'T12:00:00'), to: new Date(filters.date.endDate + 'T12:00:00') }
                          : filters.date.type === 'single' && filters.date.value
                          ? { from: new Date(filters.date.value + 'T12:00:00'), to: new Date(filters.date.value + 'T12:00:00') }
                          : undefined)}
                        onSelect={(range: { from?: Date; to?: Date } | undefined, triggerDate: Date) => {
                          if (pendingRange?.from && triggerDate.toDateString() === pendingRange.from.toDateString() && (!pendingRange.to || pendingRange.to.toDateString() === pendingRange.from.toDateString())) {
                            setPendingRange(undefined);
                            return;
                          }
                          if (pendingRange?.to && triggerDate.toDateString() === pendingRange.to.toDateString()) {
                            setPendingRange(undefined);
                            return;
                          }
                          if (range?.from) {
                            setPendingRange({ from: range.from, to: range.to });
                          } else {
                            setPendingRange(undefined);
                          }
                        }}
                      />
                    </div>
                    {pendingRange?.from && (
                      <button
                        onClick={() => {
                          const from = pendingRange.from.toISOString().split('T')[0];
                          const to = pendingRange.to ? pendingRange.to.toISOString().split('T')[0] : from;
                          if (from === to) {
                            setFilters(f => ({ ...f, date: { type: 'single', value: from } }));
                          } else {
                            setFilters(f => ({ ...f, date: { type: 'range', value: from, endDate: to } }));
                          }
                          setPendingRange(undefined);
                          closePopover();
                        }}
                        className="w-full mt-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
                      >
                        Apply{pendingRange.to && pendingRange.from.getTime() !== pendingRange.to.getTime()
                          ? ` (${Math.round((pendingRange.to.getTime() - pendingRange.from.getTime()) / 86400000) + 1} days)`
                          : ''}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Status chip */}
          {filters.status !== 'all' && (
            <div className="relative">
              <button
                onClick={() => setActivePopover(activePopover === 'status' ? null : 'status')}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-500 transition-colors"
              >
                {filters.status === 'todo' ? 'To Do' : filters.status === 'done' ? 'Done' : 'Discarded'}
                <span
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  onClick={(e) => { e.stopPropagation(); setFilters(f => ({ ...f, status: 'all' })); }}
                >
                  <FaTimes className="text-[8px]" />
                </span>
              </button>
              {activePopover === 'status' && (
                <div className="fixed sm:absolute bottom-4 sm:bottom-auto top-auto sm:top-full left-4 right-4 sm:left-auto sm:left-0 mt-1 z-50 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg p-1.5 sm:min-w-[120px]">
                  {(['todo', 'done', 'discarded'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => { setFilters(f => ({ ...f, status: s })); setActivePopover(null); }}
                      className={`w-full px-3 py-1.5 text-left text-sm rounded-lg transition-colors ${
                        filters.status === s ? 'bg-zinc-100 dark:bg-zinc-700 font-medium text-zinc-900 dark:text-white' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {s === 'todo' ? 'To Do' : s === 'done' ? 'Done' : 'Discarded'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pillar chips */}
          {filters.pillars.map(pillarId => {
            const p = pillars.find(pl => pl.id === pillarId);
            if (!p) return null;
            return (
              <span
                key={`pillar-${pillarId}`}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
              >
                {p.emoji} {p.name}
                <FaTimes
                  className="text-[8px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                  onClick={() => setFilters(f => ({ ...f, pillars: f.pillars.filter(id => id !== pillarId), goals: f.goals.filter(gId => { const gl = goalsList.find(g => g.id === gId); return !(gl && gl.pillarId === pillarId); }) }))}
                />
              </span>
            );
          })}

          {/* Goal chips */}
          {filters.goals.map(goalId => {
            const g = goalsList.find(gl => gl.id === goalId);
            if (!g) return null;
            return (
              <span
                key={`goal-${goalId}`}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
              >
                {g.name}
                <FaTimes
                  className="text-[8px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                  onClick={() => setFilters(f => ({ ...f, goals: f.goals.filter(id => id !== goalId) }))}
                />
              </span>
            );
          })}

          {/* + Filter button */}
          <div className="relative">
            <button
              onClick={() => setActivePopover(activePopover === 'add' ? null : 'add')}
              className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border border-dashed border-zinc-300 dark:border-zinc-600 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors"
            >
              <FaPlus className="text-[8px]" /> Filter
            </button>
            {activePopover === 'add' && (
              <div className="fixed sm:absolute bottom-4 sm:bottom-auto top-auto sm:top-full left-4 right-4 sm:left-auto sm:right-0 mt-1 z-50 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg p-1.5 sm:w-[180px] max-h-[360px] overflow-y-auto">
                {/* Status section */}
                {filters.status === 'all' && (
                  <>
                    <p className="px-3 py-1 text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Status</p>
                    {(['todo', 'done', 'discarded'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => { setFilters(f => ({ ...f, status: s })); setActivePopover(null); }}
                        className="w-full px-3 py-1.5 text-left text-sm rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700/50 text-zinc-600 dark:text-zinc-400"
                      >
                        {s === 'todo' ? 'To Do' : s === 'done' ? 'Done' : 'Discarded'}
                      </button>
                    ))}
                    <div className="border-t border-zinc-100 dark:border-zinc-700 my-1" />
                  </>
                )}
                {/* Pillar section */}
                <p className="px-3 py-1 text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Pillar</p>
                {pillars.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setFilters(f => ({
                      ...f,
                      pillars: f.pillars.includes(p.id) ? f.pillars.filter(id => id !== p.id) : [...f.pillars, p.id],
                    }))}
                    className={`w-full px-3 py-1.5 text-left text-sm rounded-lg transition-colors flex items-center gap-2 ${
                      filters.pillars.includes(p.id) ? 'bg-zinc-100 dark:bg-zinc-700 font-medium text-zinc-900 dark:text-white' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    <span>{p.emoji}</span> {p.name}
                    {filters.pillars.includes(p.id) && <FaCheck className="text-[10px] ml-auto text-green-500" />}
                  </button>
                ))}
                {pillars.length === 0 && <p className="px-3 py-1.5 text-sm text-zinc-400">No pillars</p>}
                <div className="border-t border-zinc-100 dark:border-zinc-700 my-1" />
                {/* Goal section */}
                <p className="px-3 py-1 text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Goal</p>
                {(filters.pillars.length > 0 ? goalsList.filter(g => g.pillarId && filters.pillars.includes(g.pillarId)) : goalsList).map(g => (
                  <button
                    key={g.id}
                    onClick={() => setFilters(f => ({
                      ...f,
                      goals: f.goals.includes(g.id) ? f.goals.filter(id => id !== g.id) : [...f.goals, g.id],
                    }))}
                    className={`w-full px-3 py-1.5 text-left text-sm rounded-lg transition-colors flex items-center gap-2 ${
                      filters.goals.includes(g.id) ? 'bg-zinc-100 dark:bg-zinc-700 font-medium text-zinc-900 dark:text-white' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    {g.name}
                    {filters.goals.includes(g.id) && <FaCheck className="text-[10px] ml-auto text-green-500" />}
                  </button>
                ))}
                {goalsList.length === 0 && <p className="px-3 py-1.5 text-sm text-zinc-400">No goals</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress underline */}
      {filters.date.type !== 'scheduled' && (
        <div className="mt-1.5 w-full h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden relative">
          {refreshing && (
            <div className="absolute inset-0 bg-zinc-300 dark:bg-zinc-600 animate-pulse" />
          )}
          {scoreSummary && (
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(scoreSummary.actionScore, 100)}%` }}
              transition={{ duration: 0.5 }}
              className={`h-full rounded-full relative z-10 ${
                scoreSummary.actionScore < 30 ? "bg-red-500" : scoreSummary.actionScore < 60 ? "bg-yellow-500" : "bg-green-500"
              }`}
            />
          )}
        </div>
      )}
    </div>
  );
}
