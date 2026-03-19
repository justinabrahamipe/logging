import { db, taskSchedules, tasks, goals } from "@/lib/db";
import { eq, and, inArray } from "drizzle-orm";
import { isScheduleForExactDate } from "@/lib/task-schedule";
import { countScheduledDaysInRange } from "@/lib/effort-calculations";

// In-memory cache: userId -> last date we ran
const lastRunCache = new Map<string, string>();

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
  const scheduleIds = allSchedules.map(s => s.id);
  const existingTasks = await db
    .select({ scheduleId: tasks.scheduleId, date: tasks.date })
    .from(tasks)
    .where(and(
      eq(tasks.userId, userId),
      inArray(tasks.scheduleId, scheduleIds),
    ));

  const existingSet = new Set(
    existingTasks
      .filter(t => t.scheduleId && t.date)
      .map(t => `${t.scheduleId}:${t.date}`)
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
async function ensureGoalTasks(userId: string, todayStr: string, dates: string[]) {
  const activeGoals = await db
    .select()
    .from(goals)
    .where(and(
      eq(goals.userId, userId),
      eq(goals.autoCreateTasks, true),
    ));

  if (activeGoals.length === 0) return;

  // Get existing goal-linked tasks to avoid duplicates
  const goalIds = activeGoals.map(g => g.id);
  const existingGoalTasks = await db
    .select({ goalId: tasks.goalId, date: tasks.date })
    .from(tasks)
    .where(and(
      eq(tasks.userId, userId),
      inArray(tasks.goalId, goalIds),
    ));

  const existingSet = new Set(
    existingGoalTasks
      .filter(t => t.goalId && t.date)
      .map(t => `${t.goalId}:${t.date}`)
  );

  for (const outcome of activeGoals) {
    const scheduleDays: number[] = outcome.scheduleDays ? JSON.parse(outcome.scheduleDays) : [];
    if (scheduleDays.length === 0) continue;

    const isHabitual = outcome.goalType === 'habitual';
    const isOutcome = outcome.goalType === 'outcome';
    const taskCompletionType = outcome.completionType || (isHabitual ? 'checkbox' : 'numeric');
    const totalScheduledDays = (outcome.startDate && outcome.targetDate)
      ? (countScheduledDaysInRange(outcome.startDate, outcome.targetDate, scheduleDays) || 1)
      : 1;
    const taskDailyTarget = taskCompletionType === 'checkbox'
      ? null
      : (outcome.dailyTarget || (isHabitual || isOutcome ? null : Math.ceil((outcome.targetValue ?? 1) / totalScheduledDays)));

    const rangeStart = outcome.startDate && outcome.startDate > todayStr ? outcome.startDate : todayStr;
    const rangeEnd = outcome.targetDate || (() => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d.toISOString().split('T')[0];
    })();

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
            basePoints: 10,
            goalId: outcome.id,
            periodId: outcome.periodId || null,
            date: dateStr,
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
  const existingTasks = await db
    .select({ scheduleId: tasks.scheduleId })
    .from(tasks)
    .where(and(
      eq(tasks.userId, userId),
      eq(tasks.date, dateStr),
      inArray(tasks.scheduleId, scheduleIds),
    ));

  const existingScheduleIds = new Set(existingTasks.map(t => t.scheduleId));

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
    completed: false,
    value: null,
    pointsEarned: 0,
    isHighlighted: false,
    completedAt: null,
  };
}
