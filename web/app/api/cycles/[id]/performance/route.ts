import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, cycles, dailyScores, goals, pillars, tasks } from "@/lib/db";
import { eq, and, gte, lte, asc, isNotNull } from "drizzle-orm";
import { errorResponse } from "@/lib/api-utils";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const cycleId = parseInt(id, 10);
  if (isNaN(cycleId) || cycleId <= 0) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const [cycle] = await db
    .select()
    .from(cycles)
    .where(and(eq(cycles.id, cycleId), eq(cycles.userId, session.user.id)));

  if (!cycle) {
    return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
  }

  // Get daily scores within cycle date range
  const scores = await db
    .select()
    .from(dailyScores)
    .where(
      and(
        eq(dailyScores.userId, session.user.id),
        gte(dailyScores.date, cycle.startDate),
        lte(dailyScores.date, cycle.endDate)
      )
    )
    .orderBy(asc(dailyScores.date));

  // Get outcomes linked to this cycle
  const cycleOutcomes = await db
    .select()
    .from(goals)
    .where(and(eq(goals.userId, session.user.id), eq(goals.periodId, cycleId)));

  // Get goal progress from completed tasks
  const outcomeIds = cycleOutcomes.map(o => o.id);
  let allLogs: { outcomeId: number; value: number; date: string }[] = [];
  if (outcomeIds.length > 0) {
    const goalTasks = await db
      .select({
        goalId: tasks.goalId,
        value: tasks.value,
        date: tasks.date,
      })
      .from(tasks)
      .where(and(
        eq(tasks.userId, session.user.id),
        eq(tasks.completed, true),
        isNotNull(tasks.goalId),
      ))
      .orderBy(asc(tasks.date));

    allLogs = goalTasks
      .filter(c => outcomeIds.includes(c.goalId!))
      .map(c => ({
        outcomeId: c.goalId!,
        value: c.value ?? 0,
        date: c.date,
      }));
  }

  // Build effort timeline (daily action scores)
  const effortData = scores.map(s => ({
    date: s.date,
    score: s.actionScore,
    pillarScores: s.pillarScores ? JSON.parse(s.pillarScores) : {},
  }));

  // Build outcome progress timeline
  const outcomeTimelines = cycleOutcomes.map(o => {
    const logs = allLogs
      .filter(l => l.outcomeId === o.id)
      .map(l => ({
        date: l.date,
        value: l.value,
        progress: Math.min(100,
          (l.value - o.startValue) / (o.targetValue - o.startValue) * 100
        ),
      }));

    return {
      id: o.id,
      name: o.name,
      unit: o.unit,
      startValue: o.startValue,
      targetValue: o.targetValue,
      currentValue: o.currentValue,
      logs,
    };
  });

  // Get pillars for metadata
  const userPillars = await db
    .select({ id: pillars.id, name: pillars.name, emoji: pillars.emoji, color: pillars.color })
    .from(pillars)
    .where(eq(pillars.userId, session.user.id));

  const startDate = new Date(cycle.startDate + 'T12:00:00');
  const endDate = new Date(cycle.endDate + 'T12:00:00');
  const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  return NextResponse.json({
    cycle: {
      id: cycle.id,
      name: cycle.name,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      totalDays,
    },
    effort: effortData,
    outcomes: outcomeTimelines,
    pillars: userPillars,
  });
  } catch (error) {
    return errorResponse(error);
  }
}
