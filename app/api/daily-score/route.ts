import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, tasks, pillars, dailyScores, goals } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { calculateDailyScore, getScoreTier } from "@/lib/scoring";
import { saveDailyScore } from "@/lib/save-daily-score";
import { ensureUpcomingTasks, ensureTasksForDate } from "@/lib/ensure-upcoming-tasks";

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();

    const date = request.nextUrl.searchParams.get('date');
    if (!date) {
      return NextResponse.json({ error: "date parameter is required" }, { status: 400 });
    }

    // Ensure task instances exist for this date
    await ensureUpcomingTasks(userId);
    await ensureTasksForDate(userId, date);

    // Get task instances, pillars, and goals in parallel
    const [allTasksForDay, userPillars, userGoals] = await Promise.all([
      db.select().from(tasks).where(and(eq(tasks.userId, userId), eq(tasks.date, date), eq(tasks.dismissed, false))),
      db.select().from(pillars).where(eq(pillars.userId, userId)),
      db.select().from(goals).where(eq(goals.userId, userId)),
    ]);

    // Exclude target and outcome goal tasks from action score (same as saveDailyScore)
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
    const tier = getScoreTier(actionScore);

    // Build pillar score breakdown with names
    const pillarBreakdown = userPillars
      .filter(p => pillarScores[p.id] !== undefined)
      .map(p => ({
        id: p.id,
        name: p.name,
        emoji: p.emoji,
        color: p.color,
        defaultBasePoints: p.defaultBasePoints,
        score: pillarScores[p.id],
      }));

    // Only recalculate momentum if no saved score exists for this date
    // (task completions already trigger saveDailyScore via the complete handler)
    let momentumScore: number | null = null;
    const [existing] = await db
      .select({ momentumScore: dailyScores.momentumScore })
      .from(dailyScores)
      .where(and(eq(dailyScores.userId, userId), eq(dailyScores.date, date)));

    if (existing) {
      momentumScore = existing.momentumScore ?? null;
    } else {
      // First view of the day — save score with momentum
      const saved = await saveDailyScore(userId, date);
      momentumScore = saved.momentumScore ?? null;
    }

    const completedTasks = allTasksForDay.filter(t => t.completed).length;

    return NextResponse.json({
      date,
      actionScore,
      momentumScore,
      scoreTier: tier,
      pillarScores: pillarBreakdown,
      totalTasks: allTasksForDay.length,
      completedTasks,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
