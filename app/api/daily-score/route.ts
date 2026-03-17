import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, tasks, pillars, taskCompletions } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { calculateDailyScore, getScoreTier } from "@/lib/scoring";
import { isTaskForDate } from "@/lib/task-schedule";
import { saveDailyScore } from "@/lib/save-daily-score";

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();

    const date = request.nextUrl.searchParams.get('date');
    if (!date) {
      return NextResponse.json({ error: "date parameter is required" }, { status: 400 });
    }

    // Get active tasks
    const allTasks = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.isActive, true)));

    // Filter tasks for the specific date
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
    const saved = await saveDailyScore(userId, date);

    const completedTasks = completions.filter(c => c.completed && tasksForDay.some(t => t.id === c.taskId)).length;

    return NextResponse.json({
      date,
      actionScore,
      momentumScore: saved.momentumScore ?? null,
      scoreTier: tier,
      pillarScores: pillarBreakdown,
      totalTasks: tasksForDay.length,
      completedTasks,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
