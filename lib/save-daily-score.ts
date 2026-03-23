import { db, tasks, pillars, dailyScores, goals } from "@/lib/db";
import { eq, and, isNotNull, or, gt } from "drizzle-orm";
import { calculateDailyScore } from "@/lib/scoring";
import { calculateMomentum, calculateTrajectory } from "@/lib/momentum";

export async function saveDailyScore(userId: string, date: string) {
  // Get task instances for this date (completion data is on the task row)
  const tasksForDay = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.date, date), eq(tasks.dismissed, false)));

  // Get pillars for weights
  const userPillars = await db
    .select()
    .from(pillars)
    .where(eq(pillars.userId, userId));

  const pillarWeights = userPillars.map(p => ({ pillarId: p.id, weight: p.weight }));

  const tasksForScoring = tasksForDay.map(t => ({
    id: t.id,
    pillarId: t.pillarId,
    completionType: t.completionType,
    target: t.target,
    basePoints: t.basePoints,
    flexibilityRule: t.flexibilityRule,
    limitValue: t.limitValue,
    minimumTarget: t.minimumTarget,
  }));

  const completionsForScoring = tasksForDay.map(t => ({
    taskId: t.id,
    completed: t.completed,
    value: t.value,
    isHighlighted: t.isHighlighted,
  }));

  const { actionScore, pillarScores } = calculateDailyScore(completionsForScoring, tasksForScoring, pillarWeights);

  // Calculate momentum from goals
  const userGoals = await db
    .select()
    .from(goals)
    .where(eq(goals.userId, userId));

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

    const goalsForMomentum = goalsForCalc.filter(g => g.goalType !== 'outcome');
    const momentum = calculateMomentum(goalsForMomentum, logsForMomentum, pillarWeights, date);
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
      isPassing,
    });
  }

  return { actionScore, momentumScore, trajectoryScore, pillarScores };
}
