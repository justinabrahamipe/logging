"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FaPlus, FaChevronDown, FaChevronRight } from "react-icons/fa";
import { Snackbar, Alert as MuiAlert } from "@mui/material";
import { formatDate } from "@/lib/format";
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
    filters,
    setFilters,
    activePopover,
    setActivePopover,
    datePickerMode,
    setDatePickerMode,
    pendingRange,
    setPendingRange,
    scoreSummary,
    timers,
    pendingValues,
    setPendingValues,
    openMenuId,
    setOpenMenuId,
    actionLoading,
    authSnackbar,
    setAuthSnackbar,
    menuRef,
    today,
    getDateLabel,
    closePopover,
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
    getDateBucket,
    isTaskInDateRange,
    passesStatusFilter,
    getScheduleLabel,
  } = hook;

  if (loading) return <TasksLoading />;

  // Build enriched + sorted task list
  const allEnrichedTasks: EnrichedTask[] = groups.flatMap((group) =>
    group.tasks.map((task) => ({ ...task, _pillarColor: group.pillar.color, _pillarEmoji: group.pillar.emoji, _pillarName: group.pillar.name }))
  ).sort((a, b) => {
    const aStarred = a.completion?.isHighlighted ? 1 : 0;
    const bStarred = b.completion?.isHighlighted ? 1 : 0;
    if (aStarred !== bStarred) return bStarred - aStarred;
    const aDone = a.completion?.completed || (a.target != null && a.target > 0 && (a.completion?.value || 0) >= a.target) ? 1 : 0;
    const bDone = b.completion?.completed || (b.target != null && b.target > 0 && (b.completion?.value || 0) >= b.target) ? 1 : 0;
    return aDone - bDone;
  });

  const starredCount = allEnrichedTasks.filter(t => t.completion?.isHighlighted).length;
  const maxStarsReached = starredCount >= 3;

  const isScheduledView = filters.date.type === 'scheduled';
  const isServerFiltered = filters.date.type === 'today' ||
    filters.date.type === 'yesterday' ||
    filters.date.type === 'tomorrow' ||
    (filters.date.type === 'single' && !!filters.date.value);

  const filteredTasks = isScheduledView ? [] : allEnrichedTasks.filter(task => {
    // For server-filtered views, skip client-side date filtering (already done by API)
    if (!isServerFiltered && !isTaskInDateRange(task)) return false;
    const completed = task.completion?.completed || (task.target != null && task.target > 0 && (task.completion?.value || 0) >= task.target);
    if (!passesStatusFilter(completed, task.completion?.value ?? null)) return false;
    if (filters.pillars.length > 0 && !filters.pillars.includes(task.pillarId)) return false;
    if (filters.goals.length > 0 && !(task.goalId && filters.goals.includes(task.goalId))) return false;
    return true;
  });

  const scheduledTasks = isScheduledView ? allEnrichedTasks.filter(task => {
    if (task.frequency === 'adhoc') return false;
    if (filters.pillars.length > 0 && !filters.pillars.includes(task.pillarId)) return false;
    if (filters.goals.length > 0 && !(task.goalId && filters.goals.includes(task.goalId))) return false;
    return true;
  }) : [];

  const displayTasks = filteredTasks;

  const taskItemProps = {
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

        {/* Task content */}
        {isScheduledView ? (
          <TaskGroup
            tasks={scheduledTasks}
            goalsList={goalsList}
            router={router}
            handleDelete={handleDelete}
            getScheduleLabel={getScheduleLabel}
          />
        ) : refreshing ? (
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
        ) : displayTasks.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
            <p className="text-sm">{allEnrichedTasks.length === 0 ? 'No tasks yet' : 'No tasks for this period'}</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.5rem' }}>
            {displayTasks.map(t => {
              const bucket = getDateBucket(t);
              const showDate = (!isServerFiltered && filters.date.type !== 'today' && bucket !== 'Today') ? (
                bucket === 'Tomorrow' ? 'Tomorrow' :
                bucket === 'No Date' ? undefined :
                t.startDate ? formatDate(t.startDate, dateFormat) : undefined
              ) : undefined;
              return <TaskItem key={t.id} task={t} showDate={showDate} {...taskItemProps} />;
            })}
          </div>
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

function NoDateAccordion({ tasks, taskItemProps }: { tasks: EnrichedTask[]; taskItemProps: React.ComponentProps<typeof TaskItem> extends infer P ? Omit<P, 'task' | 'showDate'> : never }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen(!open)}
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
