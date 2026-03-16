import { db, goals, tasks } from "@/lib/db";
import { eq, and, inArray } from "drizzle-orm";
import { countScheduledDaysInRange } from "@/lib/effort-calculations";

// In-memory cache: userId -> last date we ran
const lastRunCache = new Map<string, string>();

/**
 * Ensure upcoming task entries exist for goals with autoCreateTasks.
 * Generates for the full cycle period (startDate to targetDate).
 * Runs at most once per day per user.
 */
export async function ensureUpcomingTasks(userId: string) {
  const todayStr = new Date().toISOString().split('T')[0];

  // Skip if already ran today for this user
  if (lastRunCache.get(userId) === todayStr) return;

  // Get all active outcomes with autoCreateTasks enabled
  const activeOutcomes = await db
    .select()
    .from(goals)
    .where(and(
      eq(goals.userId, userId),
      eq(goals.isArchived, false),
      eq(goals.autoCreateTasks, true),
    ));

  if (activeOutcomes.length === 0) {
    lastRunCache.set(userId, todayStr);
    return;
  }

  // Get all existing adhoc tasks linked to these outcomes for upcoming dates
  const goalIds = activeOutcomes.map(o => o.id);
  const existingTasks = await db
    .select({ id: tasks.id, goalId: tasks.goalId, startDate: tasks.startDate })
    .from(tasks)
    .where(and(
      eq(tasks.userId, userId),
      eq(tasks.isActive, true),
      eq(tasks.frequency, 'adhoc'),
      inArray(tasks.goalId, goalIds),
    ));

  // Build a set of existing (goalId, startDate) pairs
  const existingSet = new Set(
    existingTasks
      .filter(t => t.goalId && t.startDate)
      .map(t => `${t.goalId}:${t.startDate}`)
  );

  const today = new Date();
  const taskValues: (typeof tasks.$inferInsert)[] = [];

  for (const outcome of activeOutcomes) {
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

    // Generate for the full cycle (startDate to targetDate) instead of just 7 days
    const rangeStart = outcome.startDate && outcome.startDate > todayStr ? outcome.startDate : todayStr;
    const rangeEnd = outcome.targetDate || (() => {
      const d = new Date(today);
      d.setDate(d.getDate() + 7);
      return d.toISOString().split('T')[0];
    })();

    const current = new Date(rangeStart + 'T12:00:00');
    const endDate = new Date(rangeEnd + 'T12:00:00');

    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      const dow = current.getDay();

      if (scheduleDays.includes(dow) && !existingSet.has(`${outcome.id}:${dateStr}`)) {
        taskValues.push({
          userId,
          name: outcome.name,
          pillarId: outcome.pillarId || null,
          completionType: taskCompletionType,
          target: taskDailyTarget,
          unit: taskCompletionType === 'checkbox' ? null : (outcome.unit || null),
          frequency: 'adhoc' as const,
          customDays: null,
          repeatInterval: null,
          goalId: outcome.id,
          periodId: outcome.periodId || null,
          startDate: dateStr,
          basePoints: 10,
          flexibilityRule: 'must_today',
        });
      }

      current.setDate(current.getDate() + 1);
    }
  }

  if (taskValues.length > 0) {
    await db.insert(tasks).values(taskValues);
  }

  lastRunCache.set(userId, todayStr);
}
