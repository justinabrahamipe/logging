import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, dailyScores, tasks, taskCompletions, outcomes, outcomeLogs, userStats, pillars } from "@/lib/db";
import { eq, and, gte, lte, desc, asc, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const type = request.nextUrl.searchParams.get("type") || "weekly";
  const dateParam = request.nextUrl.searchParams.get("date") || new Date().toISOString().split("T")[0];

  // Calculate date range
  const endDate = new Date(dateParam + "T00:00:00");
  const startDate = new Date(endDate);
  if (type === "monthly") {
    startDate.setDate(startDate.getDate() - 29);
  } else {
    startDate.setDate(startDate.getDate() - 6);
  }

  const startStr = startDate.toISOString().split("T")[0];
  const endStr = endDate.toISOString().split("T")[0];

  // Fetch all data in parallel
  const [scores, taskData, completionData, userPillars, statsData, outcomeData] = await Promise.all([
    // Daily scores for the range
    db.select().from(dailyScores).where(
      and(eq(dailyScores.userId, userId), gte(dailyScores.date, startStr), lte(dailyScores.date, endStr))
    ).orderBy(asc(dailyScores.date)),

    // All active tasks
    db.select({
      id: tasks.id,
      name: tasks.name,
      pillarId: tasks.pillarId,
      pillarEmoji: pillars.emoji,
    }).from(tasks)
      .leftJoin(pillars, eq(tasks.pillarId, pillars.id))
      .where(eq(tasks.userId, userId)),

    // Task completions in range
    db.select().from(taskCompletions).where(
      and(eq(taskCompletions.userId, userId), gte(taskCompletions.date, startStr), lte(taskCompletions.date, endStr))
    ),

    // Pillars
    db.select().from(pillars).where(
      and(eq(pillars.userId, userId), eq(pillars.isArchived, false))
    ),

    // User stats
    db.select().from(userStats).where(eq(userStats.userId, userId)),

    // Outcomes with logs in range
    db.select({
      id: outcomes.id,
      name: outcomes.name,
      unit: outcomes.unit,
      direction: outcomes.direction,
      pillarId: outcomes.pillarId,
    }).from(outcomes).where(
      and(eq(outcomes.userId, userId), eq(outcomes.isArchived, false))
    ),
  ]);

  // Fetch outcome logs for matched outcomes
  const outcomeIds = outcomeData.map(o => o.id);
  const startTimestamp = Math.floor(startDate.getTime() / 1000);
  const endTimestamp = Math.floor((endDate.getTime() / 1000) + 86400); // end of day

  let logData: { outcomeId: number; value: number; loggedAt: Date }[] = [];
  if (outcomeIds.length > 0) {
    logData = await db.select({
      outcomeId: outcomeLogs.outcomeId,
      value: outcomeLogs.value,
      loggedAt: outcomeLogs.loggedAt,
    }).from(outcomeLogs).where(
      and(
        eq(outcomeLogs.userId, userId),
        gte(outcomeLogs.loggedAt, startDate),
        lte(outcomeLogs.loggedAt, new Date(endTimestamp * 1000))
      )
    ).orderBy(asc(outcomeLogs.loggedAt));
  }

  // Build pillar map
  const pillarMap = new Map(userPillars.map(p => [p.id, p]));

  // --- Summary ---
  const totalDays = type === "monthly" ? 30 : 7;
  const passingDays = scores.filter(s => s.isPassing).length;
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((sum, s) => sum + s.actionScore, 0) / scores.length) : 0;
  const totalXpEarned = scores.reduce((sum, s) => sum + s.xpEarned, 0);

  let bestDay = { date: "", score: 0 };
  let worstDay = { date: "", score: 100 };
  for (const s of scores) {
    if (s.actionScore >= bestDay.score) bestDay = { date: s.date, score: s.actionScore };
    if (s.actionScore <= worstDay.score) worstDay = { date: s.date, score: s.actionScore };
  }
  if (scores.length === 0) {
    bestDay = { date: "", score: 0 };
    worstDay = { date: "", score: 0 };
  }

  const stats = statsData[0];

  // --- Pillar breakdown ---
  const pillarBreakdown = userPillars.map(p => {
    const pillarScoresArr: number[] = [];
    for (const s of scores) {
      const parsed = s.pillarScores ? JSON.parse(s.pillarScores) : {};
      if (parsed[p.id] !== undefined) {
        pillarScoresArr.push(parsed[p.id]);
      }
    }
    const avg = pillarScoresArr.length > 0
      ? Math.round(pillarScoresArr.reduce((a, b) => a + b, 0) / pillarScoresArr.length)
      : 0;
    return { id: p.id, name: p.name, emoji: p.emoji, color: p.color, avgScore: avg };
  });

  // --- Daily scores array ---
  const dailyScoresArr = scores.map(s => ({
    date: s.date,
    actionScore: s.actionScore,
    isPassing: s.isPassing,
  }));

  // --- Task completion rates ---
  const taskMap = new Map(taskData.map(t => [t.id, t]));

  // Count completions per task
  const taskCompletionCounts: Record<number, { completed: number; total: number }> = {};

  // Build a set of dates in range
  const datesInRange: string[] = [];
  const d = new Date(startDate);
  while (d <= endDate) {
    datesInRange.push(d.toISOString().split("T")[0]);
    d.setDate(d.getDate() + 1);
  }

  // For each completion, track stats
  for (const c of completionData) {
    if (!taskCompletionCounts[c.taskId]) {
      taskCompletionCounts[c.taskId] = { completed: 0, total: 0 };
    }
    taskCompletionCounts[c.taskId].total++;
    if (c.completed) {
      taskCompletionCounts[c.taskId].completed++;
    }
  }

  const taskRates = Object.entries(taskCompletionCounts).map(([taskIdStr, counts]) => {
    const taskId = Number(taskIdStr);
    const task = taskMap.get(taskId);
    const rate = counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0;
    return {
      name: task?.name || "Unknown",
      completionRate: rate,
      pillarEmoji: task?.pillarEmoji || "📌",
    };
  }).sort((a, b) => b.completionRate - a.completionRate);

  const topTasks = taskRates.slice(0, 5);
  const skippedTasks = taskRates.length > 5
    ? taskRates.slice(-5).sort((a, b) => a.completionRate - b.completionRate)
    : taskRates.slice().sort((a, b) => a.completionRate - b.completionRate).slice(0, 5);

  // --- Outcome progress ---
  const outcomeProgress = outcomeData.map(o => {
    const logs = logData.filter(l => l.outcomeId === o.id);
    const startOfPeriod = logs.length > 0 ? logs[0].value : 0;
    const endOfPeriod = logs.length > 0 ? logs[logs.length - 1].value : 0;
    const change = endOfPeriod - startOfPeriod;
    const pillar = o.pillarId ? pillarMap.get(o.pillarId) : null;

    return {
      name: o.name,
      unit: o.unit,
      direction: o.direction,
      startOfPeriod,
      endOfPeriod,
      change,
      pillarColor: pillar?.color || null,
    };
  });

  return NextResponse.json({
    type,
    dateRange: { start: startStr, end: endStr },
    summary: {
      avgScore,
      passingDays,
      totalDays,
      bestDay,
      worstDay,
      totalXpEarned: Math.round(totalXpEarned),
      currentStreak: stats?.currentStreak || 0,
      bestStreak: stats?.bestStreak || 0,
    },
    pillarBreakdown,
    dailyScores: dailyScoresArr,
    topTasks,
    skippedTasks,
    outcomeProgress,
  });
}
