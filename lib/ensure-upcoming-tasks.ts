import { db, outcomes, tasks } from "@/lib/db";
import { eq, and, inArray } from "drizzle-orm";
import { countScheduledDaysInRange } from "@/lib/effort-calculations";

// In-memory cache: userId -> last date we ran
const lastRunCache = new Map<string, string>();

/**
 * For goals with autoCreateTasks enabled, ensure adhoc tasks exist
 * for each scheduled day in the upcoming 7 days.
 * Runs at most once per day per user.
 */
export async function ensureUpcomingTasks(userId: string) {
  const todayStr = new Date().toISOString().split('T')[0];

  // Skip if already ran today for this user
  if (lastRunCache.get(userId) === todayStr) return;

  // Get all active outcomes with autoCreateTasks enabled
  const activeOutcomes = await db
    .select()
    .from(outcomes)
    .where(and(
      eq(outcomes.userId, userId),
      eq(outcomes.isArchived, false),
      eq(outcomes.autoCreateTasks, true),
    ));

  if (activeOutcomes.length === 0) {
    lastRunCache.set(userId, todayStr);
    return;
  }

  // Get all existing adhoc tasks linked to these outcomes for upcoming dates
  const outcomeIds = activeOutcomes.map(o => o.id);
  const existingTasks = await db
    .select({ id: tasks.id, outcomeId: tasks.outcomeId, startDate: tasks.startDate })
    .from(tasks)
    .where(and(
      eq(tasks.userId, userId),
      eq(tasks.isActive, true),
      eq(tasks.frequency, 'adhoc'),
      inArray(tasks.outcomeId, outcomeIds),
    ));

  // Build a set of existing (outcomeId, startDate) pairs
  const existingSet = new Set(
    existingTasks
      .filter(t => t.outcomeId && t.startDate)
      .map(t => `${t.outcomeId}:${t.startDate}`)
  );

  const today = new Date();
  const taskValues: (typeof tasks.$inferInsert)[] = [];

  for (const outcome of activeOutcomes) {
    const scheduleDays: number[] = outcome.scheduleDays ? JSON.parse(outcome.scheduleDays) : [];
    if (scheduleDays.length === 0) continue;

    const isHabitual = outcome.goalType === 'habitual';
    const isOutcome = outcome.goalType === 'outcome';
    const taskCompletionType = isOutcome ? 'numeric' : (outcome.completionType || (isHabitual ? 'checkbox' : 'count'));
    const totalScheduledDays = (outcome.startDate && outcome.targetDate)
      ? (countScheduledDaysInRange(outcome.startDate, outcome.targetDate, scheduleDays) || 1)
      : 1;
    const taskDailyTarget = isOutcome
      ? null
      : (taskCompletionType === 'checkbox' ? null : (outcome.dailyTarget || (isHabitual ? null : Math.ceil((outcome.targetValue ?? 1) / totalScheduledDays))));

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];

      if (outcome.startDate && dateStr < outcome.startDate) continue;
      if (outcome.targetDate && dateStr > outcome.targetDate) continue;
      if (dateStr < todayStr) continue;

      const dow = d.getDay();
      if (!scheduleDays.includes(dow)) continue;

      if (existingSet.has(`${outcome.id}:${dateStr}`)) continue;

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
        outcomeId: outcome.id,
        periodId: outcome.periodId || null,
        startDate: dateStr,
        basePoints: 10,
        flexibilityRule: 'must_today',
        importance: 'medium',
        toleranceBefore: null,
        toleranceAfter: null,
      });
    }
  }

  if (taskValues.length > 0) {
    await db.insert(tasks).values(taskValues);
  }

  lastRunCache.set(userId, todayStr);
}
