import { db, taskSchedules, tasks, goals } from "@/lib/db";
import { eq, and, inArray } from "drizzle-orm";
import { isScheduleForExactDate } from "@/lib/task-schedule";
import { countScheduledDaysInRange } from "@/lib/effort-calculations";

// In-memory cache: userId -> last date we ran
const lastRunCache = new Map<string, string>();

// Concurrency guard: prevent parallel ensureUpcomingTasks for the same user
const runningPromises = new Map<string, Promise<void>>();

/**
 * Invalidate the cache for a user so the next call to ensureUpcomingTasks
 * will regenerate task instances (e.g. after creating/deleting a schedule).
 */
export function invalidateTaskCache(userId: string) {
  lastRunCache.delete(userId);
}

/**
 * Ensure task instances exist for all active schedules.
 * Generates concrete task rows for today + next 7 days.
 * Also generates for overdue adhoc tasks on today.
 * Runs at most once per day per user.
 */
export async function ensureUpcomingTasks(userId: string) {
  const todayStr = new Date().toISOString().split('T')[0];

  // Skip if already ran today for this user
  if (lastRunCache.get(userId) === todayStr) return;

  // Prevent concurrent runs for the same user (avoids duplicate task creation)
  const existing = runningPromises.get(userId);
  if (existing) { await existing; return; }

  const promise = _ensureUpcomingTasksInner(userId, todayStr);
  runningPromises.set(userId, promise);
  try { await promise; } finally { runningPromises.delete(userId); }
}

async function _ensureUpcomingTasksInner(userId: string, todayStr: string) {

  // Get all active schedules for this user
  const allSchedules = await db
    .select()
    .from(taskSchedules)
    .where(eq(taskSchedules.userId, userId));

  if (allSchedules.length === 0) {
    lastRunCache.set(userId, todayStr);
    return;
  }

  // Generate date range: today + 7 days
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < 8; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }

  // Get existing task instances for these schedules and dates
  // Use originalDate (if set) to detect postponed tasks — a task moved from
  // today to tomorrow should still count as "generated for today".
  const scheduleIds = allSchedules.map(s => s.id);
  const existingTasks = await db
    .select({ scheduleId: tasks.scheduleId, date: tasks.date, originalDate: tasks.originalDate })
    .from(tasks)
    .where(and(
      eq(tasks.userId, userId),
      inArray(tasks.scheduleId, scheduleIds),
    ));

  // For dedup: use originalDate (the slot this task was generated for).
  // If postponed from Mon→Tue, Monday's slot is covered but Tuesday still needs its own task.
  const existingSet = new Set(
    existingTasks
      .filter(t => t.scheduleId && t.date)
      .map(t => `${t.scheduleId}:${t.originalDate || t.date}`)
  );

  const taskValues: (typeof tasks.$inferInsert)[] = [];

  for (const schedule of allSchedules) {
    // Skip adhoc schedules — adhoc tasks are stored directly in the tasks table
    if (schedule.frequency === 'adhoc') continue;

    // For recurring schedules, check each date in the range
    for (const dateStr of dates) {
      if (existingSet.has(`${schedule.id}:${dateStr}`)) continue;
      if (isScheduleForExactDate(schedule, dateStr)) {
        taskValues.push(buildTaskFromSchedule(schedule, dateStr, userId));
      }
    }
  }

  if (taskValues.length > 0) {
    // Use INSERT OR IGNORE to handle any race conditions with the unique constraint
    for (const val of taskValues) {
      try {
        await db.insert(tasks).values(val);
      } catch {
        // Ignore duplicate key errors (scheduleId + date unique constraint)
      }
    }
  }

  // Also generate schedules + tasks from goals with autoCreateTasks
  await ensureGoalTasks(userId, todayStr, dates);

  lastRunCache.set(userId, todayStr);
}

/**
 * Create task instances directly from goals with autoCreateTasks.
 * These go straight into the tasks table without creating schedule entries.
 */
async function ensureGoalTasks(userId: string, todayStr: string, _dates: string[]) {
  const activeGoals = await db
    .select()
    .from(goals)
    .where(and(
      eq(goals.userId, userId),
      eq(goals.autoCreateTasks, true),
      eq(goals.status, 'active'),
    ));

  if (activeGoals.length === 0) return;

  // Get existing goal-linked tasks to avoid duplicates
  // Use originalDate to detect postponed tasks
  const goalIds = activeGoals.map(g => g.id);
  const existingGoalTasks = await db
    .select({ goalId: tasks.goalId, date: tasks.date, originalDate: tasks.originalDate })
    .from(tasks)
    .where(and(
      eq(tasks.userId, userId),
      inArray(tasks.goalId, goalIds),
    ));

  // For dedup: use originalDate (the slot this task was generated for).
  // If a task was postponed from Monday to Tuesday, Monday's slot is "used up"
  // but Tuesday should still get its own task.
  const existingSet = new Set(
    existingGoalTasks
      .filter(t => t.goalId && t.date)
      .map(t => `${t.goalId}:${t.originalDate || t.date}`)
  );

  for (const outcome of activeGoals) {
    const scheduleDays: number[] = outcome.scheduleDays ? JSON.parse(outcome.scheduleDays) : [];
    if (scheduleDays.length === 0) continue;

    const isHabitual = outcome.goalType === 'habitual';
    const isOutcome = outcome.goalType === 'outcome';
    const isTarget = !isHabitual && !isOutcome;
    const taskCompletionType = outcome.completionType || (isHabitual ? 'checkbox' : 'numeric');

    let taskDailyTarget: number | null = null;
    if (taskCompletionType !== 'checkbox') {
      if (isTarget) {
        // Target goals always calculate dynamically based on remaining work / remaining days
        const remainingValue = (outcome.targetValue ?? 1) - (outcome.currentValue ?? 0);
        const remainingDays = (outcome.targetDate)
          ? (countScheduledDaysInRange(todayStr, outcome.targetDate, scheduleDays) || 1)
          : 1;
        taskDailyTarget = Math.ceil(Math.max(0, remainingValue) / remainingDays);
      } else if (outcome.dailyTarget) {
        // Explicit daily target set by user — use as-is for habitual/outcome
        taskDailyTarget = outcome.dailyTarget;
      }
    }

    const rangeStart = outcome.startDate && outcome.startDate > todayStr ? outcome.startDate : todayStr;
    // Cap at 8 days ahead (same window as schedule-based tasks) — don't generate entire cycle upfront
    const maxAhead = new Date();
    maxAhead.setDate(maxAhead.getDate() + 7);
    const maxAheadStr = maxAhead.toISOString().split('T')[0];
    const rangeEnd = outcome.targetDate && outcome.targetDate < maxAheadStr ? outcome.targetDate : maxAheadStr;

    const current = new Date(rangeStart + 'T12:00:00');
    const endDate = new Date(rangeEnd + 'T12:00:00');

    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      const dow = current.getDay();

      if (scheduleDays.includes(dow) && !existingSet.has(`${outcome.id}:${dateStr}`)) {
        const isLimit = outcome.flexibilityRule === 'limit_avoid';
        const goalLimitValue = isLimit ? (outcome.limitValue || outcome.dailyTarget || null) : null;
        try {
          await db.insert(tasks).values({
            userId,
            name: outcome.name,
            pillarId: outcome.pillarId || null,
            completionType: taskCompletionType,
            target: taskDailyTarget,
            unit: taskCompletionType === 'checkbox' ? null : (outcome.unit || null),
            flexibilityRule: outcome.flexibilityRule || 'must_today',
            limitValue: goalLimitValue,
            minimumTarget: outcome.minimumTarget ?? null,
            basePoints: 10,
            goalId: outcome.id,
            periodId: outcome.periodId || null,
            date: dateStr,
            originalDate: dateStr,
            completed: false,
            value: isLimit && goalLimitValue ? goalLimitValue : null,
            pointsEarned: 0,
            isHighlighted: false,
            completedAt: null,
          });
          existingSet.add(`${outcome.id}:${dateStr}`);
        } catch {
          // Ignore duplicates
        }
      }

      current.setDate(current.getDate() + 1);
    }
  }
}

/**
 * Recalculate per-session targets for target goals based on remaining work / remaining days.
 * This runs on every task fetch (not cached) so targets stay accurate after completing tasks.
 * Optimised: filters in-memory first, uses a single bulk update per goal, and skips
 * goals where the computed target hasn't changed.
 */
export async function recalcTargetGoalTasks(userId: string) {
  const todayStr = new Date().toISOString().split('T')[0];

  const activeGoals = await db
    .select()
    .from(goals)
    .where(and(
      eq(goals.userId, userId),
      eq(goals.autoCreateTasks, true),
      eq(goals.status, 'active'),
    ));

  // Filter to only target goals that need recalculation (in-memory, no extra queries)
  // Target goals always recalculate dynamically based on remaining work / remaining days,
  // even if dailyTarget was initially set (it's just the starting estimate).
  const targetGoals = activeGoals.filter(g => {
    if (g.goalType === 'habitual' || g.goalType === 'outcome') return false;
    const ct = g.completionType || 'numeric';
    if (ct === 'checkbox') return false;
    const days: number[] = g.scheduleDays ? JSON.parse(g.scheduleDays) : [];
    return days.length > 0;
  });

  if (targetGoals.length === 0) return;

  // Single query: get all uncompleted tasks for these goals
  const goalIds = targetGoals.map(g => g.id);
  const futureTasks = await db
    .select({ id: tasks.id, date: tasks.date, goalId: tasks.goalId, target: tasks.target })
    .from(tasks)
    .where(and(
      eq(tasks.userId, userId),
      inArray(tasks.goalId, goalIds),
      eq(tasks.completed, false),
    ));

  // Group by goalId for efficient processing
  const tasksByGoal = new Map<number, typeof futureTasks>();
  for (const ft of futureTasks) {
    if (!ft.goalId || ft.date < todayStr) continue;
    const list = tasksByGoal.get(ft.goalId) || [];
    list.push(ft);
    tasksByGoal.set(ft.goalId, list);
  }

  for (const outcome of targetGoals) {
    const scheduleDays: number[] = JSON.parse(outcome.scheduleDays!);
    const remainingValue = (outcome.targetValue ?? 1) - (outcome.currentValue ?? 0);
    const remainingDays = outcome.targetDate
      ? (countScheduledDaysInRange(todayStr, outcome.targetDate, scheduleDays) || 1)
      : 1;
    const newTarget = Math.ceil(Math.max(0, remainingValue) / remainingDays);

    // Recalculate minimumTarget proportionally
    const newMinimumTarget = outcome.minimumTarget && outcome.dailyTarget && outcome.dailyTarget > 0
      ? Math.round((outcome.minimumTarget / outcome.dailyTarget) * newTarget)
      : (outcome.minimumTarget ?? null);

    const goalTasks = tasksByGoal.get(outcome.id) || [];
    // Only update tasks whose target actually differs
    const toUpdate = goalTasks.filter(ft => ft.target !== newTarget);
    if (toUpdate.length === 0) continue;

    const ids = toUpdate.map(ft => ft.id);
    await db.update(tasks).set({ target: newTarget, minimumTarget: newMinimumTarget }).where(inArray(tasks.id, ids));
  }
}

/**
 * Ensure task instances exist for a specific date (used for on-demand generation
 * when viewing dates beyond the pre-generated 7-day window).
 */
export async function ensureTasksForDate(userId: string, dateStr: string) {
  const allSchedules = await db
    .select()
    .from(taskSchedules)
    .where(eq(taskSchedules.userId, userId));

  if (allSchedules.length === 0) return;

  const scheduleIds = allSchedules.map(s => s.id);
  // Check both current date and originalDate to detect postponed tasks
  const existingTasks = await db
    .select({ scheduleId: tasks.scheduleId, date: tasks.date, originalDate: tasks.originalDate })
    .from(tasks)
    .where(and(
      eq(tasks.userId, userId),
      inArray(tasks.scheduleId, scheduleIds),
    ));

  // A schedule is "covered" for this date if any task has this date as its originalDate (the generated slot).
  // Postponed tasks only block their original date, not their moved-to date.
  const existingScheduleIds = new Set(
    existingTasks
      .filter(t => (t.originalDate || t.date) === dateStr)
      .map(t => t.scheduleId)
  );

  const taskValues: (typeof tasks.$inferInsert)[] = [];

  for (const schedule of allSchedules) {
    if (existingScheduleIds.has(schedule.id)) continue;

    // Skip adhoc schedules — adhoc tasks are stored directly in the tasks table
    if (schedule.frequency === 'adhoc') continue;

    if (isScheduleForExactDate(schedule, dateStr)) {
      taskValues.push(buildTaskFromSchedule(schedule, dateStr, userId));
    }
  }

  if (taskValues.length > 0) {
    for (const val of taskValues) {
      try {
        await db.insert(tasks).values(val);
      } catch {
        // Ignore duplicate key errors
      }
    }
  }
}

function buildTaskFromSchedule(
  schedule: typeof taskSchedules.$inferSelect,
  dateStr: string,
  userId: string
): typeof tasks.$inferInsert {
  return {
    scheduleId: schedule.id,
    userId,
    pillarId: schedule.pillarId,
    name: schedule.name,
    completionType: schedule.completionType,
    target: schedule.target,
    unit: schedule.unit,
    flexibilityRule: schedule.flexibilityRule,
    limitValue: schedule.limitValue,
    basePoints: schedule.basePoints,
    goalId: schedule.goalId,
    periodId: schedule.periodId,
    date: dateStr,
    originalDate: dateStr,
    completed: false,
    value: null,
    pointsEarned: 0,
    isHighlighted: false,
    completedAt: null,
  };
}
