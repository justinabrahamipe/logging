import { db, tasks, pillars, dailyScores, goals } from "@/lib/db";
import { eq, and, isNotNull } from "drizzle-orm";
import { calculateDailyScore, getScoreTier } from "@/lib/scoring";
import { calculateMomentum } from "@/lib/momentum";

export async function saveDailyScore(userId: string, date: string) {
  // Get task instances for this date (completion data is on the task row)
  const tasksForDay = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.date, date), eq(tasks.isActive, true)));

  // Get pillars for weights
  const userPillars = await db
    .select()
    .from(pillars)
    .where(and(eq(pillars.userId, userId), eq(pillars.isArchived, false)));

  const pillarWeights = userPillars.map(p => ({ pillarId: p.id, weight: p.weight }));

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
  }));

  const { actionScore, pillarScores } = calculateDailyScore(completionsForScoring, tasksForScoring, pillarWeights);
  const tier = getScoreTier(actionScore);
  const isPassing = tier !== 'Poor' && tier !== 'Needs Work';

  // Calculate momentum from goals
  const userGoals = await db
    .select()
    .from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.isArchived, false)));

  let momentumScore: number | null = null;
  let pillarMomentumJson: string | null = null;

  if (userGoals.length > 0) {
    // Get all completed tasks linked to goals
    const allGoalTasks = await db
      .select({
        goalId: tasks.goalId,
        value: tasks.value,
        date: tasks.date,
      })
      .from(tasks)
      .where(and(
        eq(tasks.userId, userId),
        eq(tasks.completed, true),
        eq(tasks.isActive, true),
        isNotNull(tasks.goalId),
      ));

    const goalIds = userGoals.map(g => g.id);
    const logsForMomentum = allGoalTasks
      .filter(c => goalIds.includes(c.goalId!))
      .map(c => ({
        outcomeId: c.goalId!,
        value: c.value ?? 0,
        loggedAt: c.date + "T12:00:00.000Z",
      }));

    const goalsForMomentum = userGoals.filter(g => g.goalType !== 'outcome').map(g => ({
      id: g.id,
      goalType: g.goalType,
      pillarId: g.pillarId,
      targetValue: g.targetValue,
      startValue: g.startValue,
      currentValue: g.currentValue,
      startDate: g.startDate,
      targetDate: g.targetDate,
      scheduleDays: g.scheduleDays,
    }));

    const momentum = calculateMomentum(goalsForMomentum, logsForMomentum, pillarWeights, date);
    momentumScore = Math.round(momentum.overall * 100);
    pillarMomentumJson = JSON.stringify(momentum.pillarMomentum);
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
        pillarScores: JSON.stringify(pillarScores),
        pillarMomentum: pillarMomentumJson,
        isPassing,
        updatedAt: new Date(),
      })
      .where(eq(dailyScores.id, existing[0].id));
  } else {
    await db.insert(dailyScores).values({
      userId,
      date,
      actionScore,
      momentumScore,
      pillarScores: JSON.stringify(pillarScores),
      pillarMomentum: pillarMomentumJson,
      isPassing,
    });
  }

  return { actionScore, momentumScore, pillarScores, isPassing };
}
