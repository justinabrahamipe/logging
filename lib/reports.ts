import { db, dailyScores, tasks, taskCompletions, outcomes, outcomeLogs, userStats, pillars } from "@/lib/db";
import { eq, and, gte, lte, asc } from "drizzle-orm";

export interface ReportResult {
  type: string;
  dateRange: { start: string; end: string };
  summary: {
    avgScore: number;
    passingDays: number;
    totalDays: number;
    bestDay: { date: string; score: number };
    worstDay: { date: string; score: number };
    totalXpEarned: number;
    currentStreak: number;
    bestStreak: number;
  };
  pillarBreakdown: Array<{
    id: number;
    name: string;
    emoji: string;
    color: string;
    avgScore: number;
  }>;
  dailyScores: Array<{
    date: string;
    actionScore: number;
    isPassing: boolean;
  }>;
  topTasks: Array<{ name: string; completionRate: number; pillarEmoji: string }>;
  skippedTasks: Array<{ name: string; completionRate: number; pillarEmoji: string }>;
  outcomeProgress: Array<{
    name: string;
    unit: string;
    direction: string;
    startOfPeriod: number;
    endOfPeriod: number;
    change: number;
    pillarColor: string | null;
  }>;
}

export async function computeReport(userId: string, type: string, dateParam: string): Promise<ReportResult> {
  const endDate = new Date(dateParam + "T00:00:00");
  const startDate = new Date(endDate);
  if (type === "monthly") {
    startDate.setDate(startDate.getDate() - 29);
  } else {
    startDate.setDate(startDate.getDate() - 6);
  }

  const startStr = startDate.toISOString().split("T")[0];
  const endStr = endDate.toISOString().split("T")[0];

  const [scores, taskData, completionData, userPillars, statsData, outcomeData] = await Promise.all([
    db.select().from(dailyScores).where(
      and(eq(dailyScores.userId, userId), gte(dailyScores.date, startStr), lte(dailyScores.date, endStr))
    ).orderBy(asc(dailyScores.date)),

    db.select({
      id: tasks.id,
      name: tasks.name,
      pillarId: tasks.pillarId,
      pillarEmoji: pillars.emoji,
      outcomeId: tasks.outcomeId,
    }).from(tasks)
      .leftJoin(pillars, eq(tasks.pillarId, pillars.id))
      .where(eq(tasks.userId, userId)),

    db.select().from(taskCompletions).where(
      and(eq(taskCompletions.userId, userId), gte(taskCompletions.date, startStr), lte(taskCompletions.date, endStr))
    ),

    db.select().from(pillars).where(
      and(eq(pillars.userId, userId), eq(pillars.isArchived, false))
    ),

    db.select().from(userStats).where(eq(userStats.userId, userId)),

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

  const outcomeIds = outcomeData.map(o => o.id);
  const endTimestamp = Math.floor((endDate.getTime() / 1000) + 86400);

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

  const pillarMap = new Map(userPillars.map(p => [p.id, p]));

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

  const dailyScoresArr = scores.map(s => ({
    date: s.date,
    actionScore: s.actionScore,
    isPassing: s.isPassing,
  }));

  const taskMap = new Map(taskData.map(t => [t.id, t]));
  const taskCompletionCounts: Record<number, { completed: number; total: number }> = {};

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

  return {
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
  };
}
