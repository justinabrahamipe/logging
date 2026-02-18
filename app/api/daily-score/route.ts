import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, tasks, pillars, taskCompletions } from "@/lib/db";
import { eq, and, asc } from "drizzle-orm";
import { calculateDailyScore, getScoreTier } from "@/lib/scoring";

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

  // Filter tasks for the specific date
  const dateObj = new Date(date + 'T12:00:00');
  const dayOfWeek = dateObj.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  const tasksForDay = allTasks.filter(task => {
    if (task.isWeekendTask && !isWeekend) return false;
    if (task.frequency === 'daily') return true;
    if (task.frequency === 'weekly') {
      if (task.isWeekendTask) return dayOfWeek === 6;
      return dayOfWeek === 1;
    }
    if (task.frequency === 'custom' && task.customDays) {
      try {
        const days: number[] = JSON.parse(task.customDays);
        return days.includes(dayOfWeek);
      } catch { return true; }
    }
    return true;
  });

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
    importance: t.importance,
    basePoints: t.basePoints,
  }));

  const completionsForScoring = completions.map(c => ({
    taskId: c.taskId,
    completed: c.completed,
    value: c.value,
  }));

  const { actionScore, pillarScores } = calculateDailyScore(completionsForScoring, tasksForScoring, pillarWeights);
  const tier = getScoreTier(actionScore);

  // Build pillar score breakdown with names
  const pillarBreakdown = userPillars
    .filter(p => pillarScores[p.id] !== undefined)
    .map(p => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      color: p.color,
      weight: p.weight,
      score: pillarScores[p.id],
    }));

  return NextResponse.json({
    date,
    actionScore,
    scoreTier: tier,
    pillarScores: pillarBreakdown,
    totalTasks: tasksForDay.length,
    completedTasks: completions.filter(c => c.completed).length,
  });
}
