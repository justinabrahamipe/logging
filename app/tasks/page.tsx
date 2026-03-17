"use client";

import { motion } from "framer-motion";
import { FaPlus } from "react-icons/fa";
import { Snackbar, Alert as MuiAlert } from "@mui/material";
import { formatDate } from "@/lib/format";
import { useTasksPage } from "./hooks/useTasksPage";
import DateNavigation from "./components/DateNavigation";
import TaskItem from "./components/TaskItem";
import type { EnrichedTask } from "./components/TaskItem";
import TaskGroup from "./components/TaskGroup";

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
    pastDays,
    pastLoading,
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
    formatTime,
    getDateBucket,
    isTaskInDateRange,
    passesStatusFilter,
    getScheduleLabel,
  } = hook;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 dark:border-white"></div>
      </div>
    );
  }

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
  const isPastDateView = !isScheduledView && (
    filters.date.type === 'yesterday' ||
    (filters.date.type === 'single' && filters.date.value && filters.date.value < today)
  );

  const filteredTasks = (isPastDateView || isScheduledView) ? [] : allEnrichedTasks.filter(task => {
    if (!isTaskInDateRange(task)) return false;
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

  const pastEnrichedTasks: EnrichedTask[] = isPastDateView ? pastDays.flatMap(day =>
    day.tasks.map(t => ({
      id: t.id,
      userId: '',
      name: t.name,
      pillarId: pillars.find(p => p.name === t.pillarName)?.id ?? 0,
      completionType: t.completionType,
      target: t.target,
      unit: t.unit,
      frequency: 'adhoc' as const,
      customDays: null,
      repeatInterval: null,
      goalId: t.goalId,
      periodId: null,
      startDate: day.date,
      basePoints: 10,
      flexibilityRule: 'must_today',
      isActive: true,
      createdAt: day.date,
      completion: {
        id: 0,
        taskId: t.id,
        completed: t.completed,
        value: t.value ?? 0,
        pointsEarned: 0,
        isHighlighted: t.isHighlighted,
      },
      _pillarColor: t.pillarColor || '#6B7280',
      _pillarEmoji: t.pillarEmoji || '',
      _pillarName: t.pillarName || '',
    }))
  ) : [];

  // Unified task list: past enriched tasks or filtered current tasks
  const displayTasks = isPastDateView ? pastEnrichedTasks.filter(t => {
    const completed = t.completion?.completed || (t.target != null && t.target > 0 && (t.completion?.value || 0) >= t.target);
    if (!passesStatusFilter(completed, t.completion?.value ?? null)) return false;
    if (filters.pillars.length > 0 && !filters.pillars.includes(t.pillarId)) return false;
    if (filters.goals.length > 0 && !(t.goalId && filters.goals.includes(t.goalId))) return false;
    return true;
  }) : filteredTasks;
  const isDisplayLoading = isPastDateView ? pastLoading : false;

  // Compute task counts from what's actually displayed
  const displayTotal = displayTasks.length;
  const displayCompleted = displayTasks.filter(t =>
    t.completion?.completed || (t.target != null && t.target > 0 && (t.completion?.value || 0) >= t.target)
  ).length;
  const adjustedScoreSummary = scoreSummary ? {
    ...scoreSummary,
    totalTasks: displayTotal,
    completedTasks: displayCompleted,
  } : null;

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
    formatTime,
  };

  return (
    <div className="px-3 py-4 md:px-6 md:py-6 overflow-x-hidden">
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
          scoreSummary={adjustedScoreSummary}
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
        ) : isDisplayLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-zinc-900 dark:border-white mx-auto"></div>
          </div>
        ) : displayTasks.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
            <p className="text-sm">{allEnrichedTasks.length === 0 && pastDays.length === 0 ? 'No tasks yet' : 'No tasks for this period'}</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.5rem' }}>
            {displayTasks.map(t => {
              const bucket = getDateBucket(t);
              const showDate = (!isPastDateView && filters.date.type !== 'today' && bucket !== 'Today') ? (
                bucket === 'Tomorrow' ? 'Tomorrow' :
                bucket === 'No Date' ? undefined :
                t.startDate ? formatDate(t.startDate, dateFormat) : undefined
              ) : undefined;
              return <TaskItem key={t.id} task={t} showDate={showDate} {...taskItemProps} />;
            })}
          </div>
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
