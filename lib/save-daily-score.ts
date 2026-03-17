import { db, tasks, pillars, taskCompletions, dailyScores, goals } from "@/lib/db";
import { eq, and, isNotNull } from "drizzle-orm";
import { calculateDailyScore, getScoreTier } from "@/lib/scoring";
import { isTaskForDate } from "@/lib/task-schedule";
import { calculateMomentum } from "@/lib/momentum";

export async function saveDailyScore(userId: string, date: string) {
  // Get active tasks for this date
  const allTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.isActive, true)));

  const tasksForDay = allTasks.filter(task => isTaskForDate(task, date));

  // Get completions
  const completions = await db
    .select()
    .from(taskCompletions)
    .where(and(eq(taskCompletions.userId, userId), eq(taskCompletions.date, date)));

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

  const completionsForScoring = completions.map(c => ({
    taskId: c.taskId,
    completed: c.completed,
    value: c.value,
    isHighlighted: c.isHighlighted,
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
    const goalIds = userGoals.map(g => g.id);

    // Query TaskCompletions joined with Tasks where task has a goalId
    const allCompletions = await db
      .select({
        goalId: tasks.goalId,
        value: taskCompletions.value,
        date: taskCompletions.date,
      })
      .from(taskCompletions)
      .innerJoin(tasks, eq(taskCompletions.taskId, tasks.id))
      .where(and(
        eq(taskCompletions.userId, userId),
        eq(taskCompletions.completed, true),
        isNotNull(tasks.goalId),
      ));

    const logsForMomentum = allCompletions
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
