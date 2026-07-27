import { db, tasks, dailyScores, goals } from "@/lib/db";
import { eq, and, isNotNull, or, gt } from "drizzle-orm";
import { calculateDailyScore } from "@/lib/scoring";
import { calculateMomentum, calculateTrajectory } from "@/lib/momentum";
import { getYesterdayString } from "@/lib/format";

// Recalculate scores for both the old and new date when a task is moved between dates.
export async function recalculateDateScores(userId: string, oldDate: string | null, newDate: string | null | undefined): Promise<void> {
  if (oldDate && newDate !== undefined && oldDate !== newDate) {
    await saveDailyScore(userId, oldDate);
    if (newDate) await saveDailyScore(userId, newDate);
  }
}

export async function saveDailyScore(userId: string, date: string) {
  // Only recalculate scores for today and yesterday — older scores are frozen
  const yesterdayStr = getYesterdayString();
  if (date < yesterdayStr) return null;

  // Get task instances for this date (completion data is on the task row)
  const allTasksForDay = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.date, date), eq(tasks.dismissed, false)));

  // Exclude target and outcome goal tasks from action score — they only affect momentum/trajectory
  const userGoals = await db
    .select()
    .from(goals)
    .where(eq(goals.userId, userId));

  const excludedGoalIds = new Set(userGoals.filter(g => g.goalType === 'target' || g.goalType === 'outcome').map(g => g.id));
  const tasksForDay = allTasksForDay.filter(t => !t.goalId || !excludedGoalIds.has(t.goalId));

  const tasksForScoring = tasksForDay.map(t => ({
    id: t.id,
    pillarId: t.pillarId,
    completionType: t.completionType,
    target: t.target,
    basePoints: t.basePoints,
    flexibilityRule: t.flexibilityRule,
    limitValue: t.limitValue,
  }));

  const completionsForScoring = tasksForDay.map(t => ({
    taskId: t.id,
    completed: t.completed,
    value: t.value,
    isHighlighted: t.isHighlighted,
    skipped: t.skipped,
  }));

  const { actionScore, pillarScores } = calculateDailyScore(completionsForScoring, tasksForScoring);

  // Calculate momentum from goals (userGoals already fetched above)
  let momentumScore: number | null = null;
  let trajectoryScore: number | null = null;
  let pillarMomentumJson: string | null = null;

  if (userGoals.length > 0) {
    // Get all goal-linked tasks with progress
    const allGoalTasks = await db
      .select({
        goalId: tasks.goalId,
        value: tasks.value,
        date: tasks.date,
        completed: tasks.completed,
      })
      .from(tasks)
      .where(and(
        eq(tasks.userId, userId),
        isNotNull(tasks.goalId),
        or(
          eq(tasks.completed, true),
          gt(tasks.value, 0),
        ),
      ));

    const goalIds = userGoals.map(g => g.id);
    const logsForMomentum = allGoalTasks
      .filter(c => goalIds.includes(c.goalId!))
      .map(c => ({
        outcomeId: c.goalId!,
        value: c.value != null ? c.value : 1,
        loggedAt: c.date + "T12:00:00.000Z",
      }));

    const goalsForCalc = userGoals.map(g => ({
      id: g.id,
      goalType: g.goalType,
      pillarId: g.pillarId,
      targetValue: g.targetValue,
      startValue: g.startValue,
      currentValue: g.currentValue,
      startDate: g.startDate,
      targetDate: g.targetDate,
      scheduleDays: g.scheduleDays,
      flexibilityRule: g.flexibilityRule,
      limitValue: g.limitValue,
      dailyTarget: g.dailyTarget,
      completionType: g.completionType,
    }));

    const goalsForMomentum = goalsForCalc.filter(g => g.goalType === 'target');
    const momentum = calculateMomentum(goalsForMomentum, logsForMomentum, date);
    momentumScore = Math.round(momentum.overall * 100);
    pillarMomentumJson = JSON.stringify(momentum.pillarMomentum);

    // Calculate trajectory for outcome goals
    const trajResult = calculateTrajectory(goalsForCalc, date);
    if (trajResult.goals.length > 0) {
      trajectoryScore = Math.round(trajResult.overall * 100);
    }
  }

  // Upsert daily score
  const existing = await db
    .select()
    .from(dailyScores)
    .where(and(eq(dailyScores.userId, userId), eq(dailyScores.date, date)));

  if (existing.length > 0) {
    await db
      .update(dailyScores)
      .set({
        actionScore,
        momentumScore,
        trajectoryScore,
        pillarScores: JSON.stringify(pillarScores),
        pillarMomentum: pillarMomentumJson,

        updatedAt: new Date(),
      })
      .where(eq(dailyScores.id, existing[0].id));
  } else {
    await db.insert(dailyScores).values({
      userId,
      date,
      actionScore,
      momentumScore,
      trajectoryScore,
      pillarScores: JSON.stringify(pillarScores),
      pillarMomentum: pillarMomentumJson,
    });
  }

  return { actionScore, momentumScore, trajectoryScore, pillarScores };
}
