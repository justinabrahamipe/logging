import { db, taskSchedules, tasks, goals } from "@/lib/db";
import { eq, and, inArray, lt } from "drizzle-orm";
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

  // Auto-skip past incomplete tasks (date has passed, not completed/skipped/dismissed)
  await db.update(tasks)
    .set({ skipped: true })
    .where(and(
      eq(tasks.userId, userId),
      eq(tasks.completed, false),
      eq(tasks.skipped, false),
      eq(tasks.dismissed, false),
      lt(tasks.date, todayStr),
    ));

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

  lastRunCache.set(userId, todayStr);
}

/**
 * Generate all task instances for a single goal across its full date range.
 * Called when a goal is created or edited (event-driven, not lazy).
 * Skips dates that already have tasks (dedup via originalDate).
 */
export async function generateGoalTasks(userId: string, goalId: number) {
  const [outcome] = await db
    .select()
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)));

  if (!outcome || !outcome.autoCreateTasks || outcome.status !== 'active') return;

  const scheduleDays: number[] = outcome.scheduleDays ? JSON.parse(outcome.scheduleDays) : [];
  if (scheduleDays.length === 0) return;

  const todayStr = new Date().toISOString().split('T')[0];

  // Get existing tasks to avoid duplicates
  const existingGoalTasks = await db
    .select({ date: tasks.date, originalDate: tasks.originalDate })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.goalId, goalId)));

  const existingSet = new Set(
    existingGoalTasks
      .filter(t => t.date)
      .map(t => t.originalDate || t.date)
  );

  const isHabitual = outcome.goalType === 'habitual';
  const isOutcome = outcome.goalType === 'outcome';
  const isTarget = !isHabitual && !isOutcome;
  const taskCompletionType = outcome.completionType || (isHabitual ? 'checkbox' : 'numeric');

  let taskDailyTarget: number | null = null;
  if (taskCompletionType !== 'checkbox') {
    if (isTarget) {
      const remainingValue = (outcome.targetValue ?? 1) - (outcome.currentValue ?? 0);
      // Count remaining scheduled days from tomorrow (matches calculateEffortMetrics)
      const isFuture = todayStr < (outcome.startDate || todayStr);
      let remainingDays: number;
      if (isFuture) {
        remainingDays = outcome.targetDate
          ? countScheduledDaysInRange(outcome.startDate!, outcome.targetDate, scheduleDays) || 1
          : 1;
      } else {
        const tmrw = new Date(todayStr + 'T12:00:00');
        tmrw.setDate(tmrw.getDate() + 1);
        const tmrwStr = tmrw.toISOString().split('T')[0];
        remainingDays = outcome.targetDate
          ? (countScheduledDaysInRange(tmrwStr, outcome.targetDate, scheduleDays) || 1)
          : 1;
      }
      taskDailyTarget = Math.ceil(Math.max(0, remainingValue) / remainingDays);
    } else if (outcome.dailyTarget) {
      taskDailyTarget = outcome.dailyTarget;
    }
  }

  // Full range: startDate (or today) to targetDate (or 7 days ahead if no end date)
  const rangeStart = outcome.startDate && outcome.startDate > todayStr ? outcome.startDate : todayStr;
  let rangeEnd: string;
  if (outcome.targetDate) {
    rangeEnd = outcome.targetDate;
  } else {
    const maxAhead = new Date();
    maxAhead.setDate(maxAhead.getDate() + 7);
    rangeEnd = maxAhead.toISOString().split('T')[0];
  }

  const current = new Date(rangeStart + 'T12:00:00');
  const endDate = new Date(rangeEnd + 'T12:00:00');

  while (current <= endDate) {
    const dateStr = current.toISOString().split('T')[0];
    const dow = current.getDay();

    if (scheduleDays.includes(dow) && !existingSet.has(dateStr)) {
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
      } catch {
        // Ignore duplicates
      }
    }

    current.setDate(current.getDate() + 1);
  }
}

/**
 * Recalculate per-session targets for target goals based on remaining work / remaining days.
 * Recalculates after task completions. Cached for 30 seconds per user to avoid
 * redundant queries on rapid page loads.
 * Optimised: filters in-memory first, uses a single bulk update per goal, and skips
 * goals where the computed target hasn't changed.
 */
const recalcCache = new Map<string, number>(); // userId -> last run timestamp
const RECALC_TTL = 30_000; // 30 seconds

export function invalidateRecalcCache(userId: string) {
  recalcCache.delete(userId);
}

export async function recalcTargetGoalTasks(userId: string) {
  const now = Date.now();
  const lastRun = recalcCache.get(userId);
  if (lastRun && now - lastRun < RECALC_TTL) return;
  recalcCache.set(userId, now);
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

  // Calculate tomorrow's date for consistent "from tomorrow" counting
  const tomorrow = new Date(todayStr + 'T12:00:00');
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  for (const outcome of targetGoals) {
    const scheduleDays: number[] = JSON.parse(outcome.scheduleDays!);
    const remainingValue = (outcome.targetValue ?? 1) - (outcome.currentValue ?? 0);
    // Count remaining scheduled days from tomorrow (matches calculateEffortMetrics)
    // Today's work is already reflected in currentValue
    const isFuture = todayStr < (outcome.startDate || todayStr);
    const remainingDays = isFuture
      ? (countScheduledDaysInRange(outcome.startDate!, outcome.targetDate!, scheduleDays) || 1)
      : (outcome.targetDate
        ? (countScheduledDaysInRange(tomorrowStr, outcome.targetDate, scheduleDays) || 1)
        : 1);
    const goalTasks = tasksByGoal.get(outcome.id) || [];
    const newTarget = Math.ceil(Math.max(0, remainingValue) / remainingDays);

    // Recalculate minimumTarget proportionally
    const newMinimumTarget = outcome.minimumTarget && outcome.dailyTarget && outcome.dailyTarget > 0
      ? Math.round((outcome.minimumTarget / outcome.dailyTarget) * newTarget)
      : (outcome.minimumTarget ?? null);

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
