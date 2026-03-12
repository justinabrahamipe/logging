import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, tasks, pillars, taskCompletions } from "@/lib/db";
import { eq, and, inArray } from "drizzle-orm";
import { calculateDailyScore, getScoreTier } from "@/lib/scoring";
import { isTaskForDate } from "@/lib/task-schedule";
import { saveDailyScore } from "@/lib/save-daily-score";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = request.nextUrl.searchParams.get('date');
  if (!date) {
    return NextResponse.json({ error: "date parameter is required" }, { status: 400 });
  }

  // Get active tasks
  const allTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, session.user.id), eq(tasks.isActive, true)));

  // Filter tasks for the specific date, excluding adhoc tasks without a startDate
  let tasksForDay = allTasks.filter(task => {
    if (task.frequency === 'adhoc' && !task.startDate) return false;
    return isTaskForDate(task, date);
  });

  // Exclude adhoc tasks that were carried forward and already completed
  const adhocIds = tasksForDay
    .filter(t => {
      if (t.frequency !== 'adhoc') return false;
      return t.startDate && t.startDate !== date;
    })
    .map(t => t.id);

  if (adhocIds.length > 0) {
    const completedAdhoc = await db
      .select({ taskId: taskCompletions.taskId })
      .from(taskCompletions)
      .where(and(
        eq(taskCompletions.userId, session.user.id),
        inArray(taskCompletions.taskId, adhocIds),
        eq(taskCompletions.completed, true),
      ));
    const completedSet = new Set(completedAdhoc.map(c => c.taskId));
    tasksForDay = tasksForDay.filter(t => !(t.frequency === 'adhoc' && completedSet.has(t.id)));
  }

  // Get completions
  const completions = await db
    .select()
    .from(taskCompletions)
    .where(and(eq(taskCompletions.userId, session.user.id), eq(taskCompletions.date, date)));

  // Get pillars for weights
  const userPillars = await db
    .select()
    .from(pillars)
    .where(and(eq(pillars.userId, session.user.id), eq(pillars.isArchived, false)));

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

  // Compute effective weights for display
  const assignedWeight = userPillars.reduce((sum, p) => sum + (p.weight || 0), 0);
  const unweightedPillars = userPillars.filter(p => !p.weight || p.weight === 0);
  const remainingWeight = Math.max(0, 100 - assignedWeight);
  const autoWeight = unweightedPillars.length > 0 ? Math.round(remainingWeight / unweightedPillars.length) : 0;

  // Build pillar score breakdown with names
  const pillarBreakdown = userPillars
    .filter(p => pillarScores[p.id] !== undefined)
    .map(p => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      color: p.color,
      weight: p.weight || autoWeight,
      score: pillarScores[p.id],
    }));

  // Persist daily score to history (includes momentum calculation)
  const saved = await saveDailyScore(session.user.id, date);

  return NextResponse.json({
    date,
    actionScore,
    momentumScore: saved.momentumScore ?? null,
    scoreTier: tier,
    pillarScores: pillarBreakdown,
    totalTasks: tasksForDay.length,
    completedTasks: completions.filter(c => c.completed && tasksForDay.some(t => t.id === c.taskId)).length,
  });
}
