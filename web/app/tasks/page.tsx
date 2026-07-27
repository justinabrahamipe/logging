"use client";

import { useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { FaPlus, FaChevronDown, FaChevronRight } from "react-icons/fa";
import AdBanner from "@/app/(common)/AdBanner";
import { Snackbar, Alert as MuiAlert } from "@mui/material";
import { formatDate } from "@/lib/format";
import { calculateRemainingPoints } from "@/lib/scoring";
import { useTasksPage } from "./hooks/useTasksPage";
import DateNavigation from "./components/DateNavigation";
import TaskItem from "./components/TaskItem";
import type { EnrichedTask } from "./components/TaskItem";
import TaskGroup from "./components/TaskGroup";
import TasksLoading from "./loading";

export default function TasksPage() {
  const hook = useTasksPage();
  const {
    router,
    dateFormat,
    groups,
    pillars,
    goalsList,
    cycles,
    loading,
    refreshing,
    noDateTasks,
    overdueTasks,
    filters,
    setFilters,
    searchQuery,
    setSearchQuery,
    activePopover,
    setActivePopover,
    datePickerMode,
    setDatePickerMode,
    pendingRange,
    setPendingRange,
    scoreSummary,
    sortVersion,
    timers,
    pendingValues,
    setPendingValues,
    actionLoading,
    authSnackbar,
    setAuthSnackbar,
    getDateLabel,
    closePopover,
    handleCheckboxToggle,
    handleCountChange,
    handleNumericSubmit,
    handleTimerToggle,
    handleDurationManualSubmit,
    handleHighlightToggle,
    handleDiscard,
    formatTime,
    getDateBucket,
    isTaskInDateRange,
    getScheduleLabel,
    handleDelete,
  } = hook;

  const isScheduledView = filters.date.type === 'scheduled';
  const isServerFiltered = filters.date.type === 'today' ||
    filters.date.type === 'yesterday' ||
    filters.date.type === 'tomorrow' ||
    (filters.date.type === 'single' && !!filters.date.value);

  // Sort keys are frozen per-task and only re-snapshot when a full fetch
  // bumps `sortVersion`. Incrementing a count/timer/numeric value does not
  // bump the version, so the task stays in place until the next refresh.
  const sortKeysRef = useRef<Map<number, { starred: boolean; remaining: number }>>(new Map());
  const lastSortVersionRef = useRef<number>(-1);

  const allEnrichedTasks: EnrichedTask[] = useMemo(() => {
    const enriched = groups.flatMap((group) =>
      group.tasks.map((task) => ({ ...task, _pillarColor: group.pillar.color, _pillarEmoji: group.pillar.emoji, _pillarName: group.pillar.name }))
    );
    if (lastSortVersionRef.current !== sortVersion) {
      sortKeysRef.current.clear();
      lastSortVersionRef.current = sortVersion;
    }
    for (const t of enriched) {
      if (!sortKeysRef.current.has(t.id)) {
        sortKeysRef.current.set(t.id, {
          starred: !!t.completion?.isHighlighted,
          remaining: calculateRemainingPoints(t, t.completion),
        });
      }
    }
    return enriched.sort((a, b) => {
      const ka = sortKeysRef.current.get(a.id)!;
      const kb = sortKeysRef.current.get(b.id)!;
      const aStarred = ka.starred ? 1 : 0;
      const bStarred = kb.starred ? 1 : 0;
      if (aStarred !== bStarred) return bStarred - aStarred;
      return kb.remaining - ka.remaining;
    });
  }, [groups, sortVersion]);

  const starredCount = useMemo(() => allEnrichedTasks.filter(t => t.completion?.isHighlighted).length, [allEnrichedTasks]);
  const maxStarsReached = starredCount >= 3;

  const filteredTasks = useMemo(() =>
    isScheduledView ? [] : allEnrichedTasks.filter(task => {
      if (!isServerFiltered && !isTaskInDateRange(task)) return false;
      if (filters.pillars.length > 0 && !filters.pillars.includes(task.pillarId)) return false;
      if (filters.goals.length > 0 && !(task.goalId && filters.goals.includes(task.goalId))) return false;
      return true;
    }), [allEnrichedTasks, isScheduledView, isServerFiltered, isTaskInDateRange, filters.pillars, filters.goals]);

  const totalBasePoints = useMemo(() => {
    const excluded = new Set(goalsList.filter(g => g.goalType === 'target' || g.goalType === 'outcome').map(g => g.id));
    const scorable = filteredTasks.filter(t => t.startDate && (!t.goalId || !excluded.has(t.goalId)));
    return scorable.reduce((sum, t) => sum + (t.basePoints || 0) * (t.completion?.isHighlighted ? 2 : 1), 0);
  }, [filteredTasks, goalsList]);

  const scheduledTasks = useMemo(() =>
    isScheduledView ? allEnrichedTasks.filter(task => {
      if (task.frequency === 'adhoc') return false;
      if (filters.pillars.length > 0 && !filters.pillars.includes(task.pillarId)) return false;
      if (filters.goals.length > 0 && !(task.goalId && filters.goals.includes(task.goalId))) return false;
      return true;
    }) : [], [isScheduledView, allEnrichedTasks, filters.pillars, filters.goals]);

  if (loading) return <TasksLoading />;

  const taskItemProps = {
    goalsList,
    cycles,
    maxStarsReached,
    totalBasePoints,
    timers,
    pendingValues,
    setPendingValues,
    actionLoading,
    router,
    handleCheckboxToggle,
    handleCountChange,
    handleNumericSubmit,
    handleTimerToggle,
    handleDurationManualSubmit,
    handleHighlightToggle,
    handleDiscard,
    formatTime,
  };

  const renderTaskList = () => {
    if (filteredTasks.length === 0) {
      return (
        <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
          <p className="text-sm">{allEnrichedTasks.length === 0 ? 'No tasks yet' : 'No tasks for this period'}</p>
        </div>
      );
    }

    const isDone = (t: EnrichedTask) =>
      t.completion?.completed || (t.target != null && t.target > 0 && (t.completion?.value || 0) >= t.target);
    const isSkipped = (t: EnrichedTask) => t.completion?.skipped;

    const todoTasks = filteredTasks.filter(t => !isDone(t) && !isSkipped(t));
    const doneTasks = filteredTasks.filter(t => isDone(t) && !isSkipped(t));
    const skippedTasks = filteredTasks.filter(t => isSkipped(t));

    const renderItem = (t: EnrichedTask) => {
      const bucket = getDateBucket(t);
      const showDate = (!isServerFiltered && filters.date.type !== 'today' && bucket !== 'Today') ? (
        bucket === 'Tomorrow' ? 'Tomorrow' :
        bucket === 'No Date' ? undefined :
        t.startDate ? formatDate(t.startDate, dateFormat) : undefined
      ) : undefined;
      return <TaskItem key={t.id} task={t} showDate={showDate} {...taskItemProps} />;
    };

    const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.5rem' };

    return (
      <>
        {todoTasks.length > 0 && (
          <TaskSectionAccordion storageKey="todoAccordionOpen" label="To Do" count={todoTasks.length} color="text-zinc-600 dark:text-zinc-300">
            <div style={gridStyle}>{todoTasks.map(renderItem)}</div>
          </TaskSectionAccordion>
        )}
        <AdBanner slot="tasks-mid" />
        {skippedTasks.length > 0 && (
          <TaskSectionAccordion storageKey="skippedAccordionOpen" label="Skipped" count={skippedTasks.length} color="text-amber-500 dark:text-amber-400">
            <div style={gridStyle}>{skippedTasks.map(renderItem)}</div>
          </TaskSectionAccordion>
        )}
        {doneTasks.length > 0 && (
          <TaskSectionAccordion storageKey="doneAccordionOpen" label="Done" count={doneTasks.length} color="text-green-500 dark:text-green-400">
            <div style={gridStyle}>{doneTasks.map(renderItem)}</div>
          </TaskSectionAccordion>
        )}
      </>
    );
  };

  return (
    <div className="px-3 py-4 md:px-6 md:py-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <DateNavigation
          filters={filters}
          setFilters={setFilters}
          activePopover={activePopover}
          setActivePopover={setActivePopover}
          datePickerMode={datePickerMode}
          setDatePickerMode={setDatePickerMode}
          pendingRange={pendingRange}
          setPendingRange={setPendingRange}
          scoreSummary={scoreSummary}
          refreshing={refreshing}
          pillars={pillars}
          goalsList={goalsList}
          getDateLabel={getDateLabel}
          closePopover={closePopover}
        />

        <div className="mb-3 mt-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks…"
            className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400"
          />
        </div>

        {/* Task content */}
        {isScheduledView ? (
          <TaskGroup
            tasks={scheduledTasks}
            goalsList={goalsList}
            router={router}
            handleDelete={handleDelete}
            getScheduleLabel={getScheduleLabel}
          />
        ) : (
          <>
            {/* Overdue tasks (today view only): project subtasks and ad-hoc tasks from past days */}
            {isServerFiltered && filters.date.type === 'today' && overdueTasks.length > 0 && (() => {
              const enriched = overdueTasks.map(t => {
                const p = pillars.find(pl => pl.id === t.pillarId);
                return { ...t, _pillarColor: p?.color || '#6B7280', _pillarEmoji: p?.emoji || '📋', _pillarName: p?.name || 'No Pillar' } as EnrichedTask;
              });
              return (
                <TaskSectionAccordion storageKey="overdueAccordionOpen" label="Overdue" count={enriched.length} color="text-red-500 dark:text-red-400">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.5rem' }}>
                    {enriched.map(t => (
                      <TaskItem key={t.id} task={t} showDate={t.startDate ? formatDate(t.startDate, dateFormat) : undefined} {...taskItemProps} />
                    ))}
                  </div>
                </TaskSectionAccordion>
              );
            })()}
            {refreshing && filteredTasks.length === 0 ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse w-3/4" />
                        <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse w-1/3" />
                      </div>
                      <div className="w-7 h-7 bg-zinc-200 dark:bg-zinc-700 rounded-md animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : renderTaskList()}
          </>
        )}
        {/* No-date tasks accordion (today view only) */}
        {isServerFiltered && filters.date.type === 'today' && noDateTasks.length > 0 && (
          <NoDateAccordion
            tasks={noDateTasks.map(t => {
              const p = pillars.find(p => p.id === t.pillarId);
              return { ...t, _pillarColor: p?.color || '#6B7280', _pillarEmoji: p?.emoji || '📋', _pillarName: p?.name || 'No Pillar' };
            })}
            taskItemProps={taskItemProps}
          />
        )}
      </motion.div>

      {/* Floating Add Task button */}
      <button
        onClick={() => router.push("/tasks/new")}
        className="fixed bottom-20 md:bottom-14 right-4 md:right-8 z-40 w-12 h-12 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-lg flex items-center justify-center hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
      >
        <FaPlus className="text-lg" />
      </button>

      <Snackbar
        open={authSnackbar}
        autoHideDuration={3000}
        onClose={() => setAuthSnackbar(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <MuiAlert onClose={() => setAuthSnackbar(false)} severity="info" variant="filled" sx={{ width: "100%" }}>
          Sign in to track your tasks
        </MuiAlert>
      </Snackbar>
    </div>
  );
}

function TaskSectionAccordion({ storageKey, label, count, color, children }: { storageKey: string; label: string; count: number; color: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });
  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    localStorage.setItem(storageKey, String(next));
  };
  return (
    <div className="mt-4">
      <button
        onClick={toggleOpen}
        className={`w-full flex items-center gap-2 px-1 py-2 text-xs font-medium ${color}`}
      >
        {open ? <FaChevronDown className="text-[10px]" /> : <FaChevronRight className="text-[10px]" />}
        {label} ({count})
      </button>
      {open && children}
    </div>
  );
}

function NoDateAccordion({ tasks, taskItemProps }: { tasks: EnrichedTask[]; taskItemProps: React.ComponentProps<typeof TaskItem> extends infer P ? Omit<P, 'task' | 'showDate'> : never }) {
  const [open, setOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('noDateAccordionOpen');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });
  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    localStorage.setItem('noDateAccordionOpen', String(next));
  };
  return (
    <div className="mt-4">
      <button
        onClick={toggleOpen}
        className="w-full flex items-center gap-2 px-1 py-2 text-xs font-medium text-zinc-400 dark:text-zinc-500"
      >
        {open ? <FaChevronDown className="text-[10px]" /> : <FaChevronRight className="text-[10px]" />}
        No Date ({tasks.length})
      </button>
      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.5rem' }}>
          {tasks.map(t => (
            <TaskItem key={t.id} task={t} {...taskItemProps} />
          ))}
        </div>
      )}
    </div>
  );
}
