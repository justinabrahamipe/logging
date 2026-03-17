import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, cycles, dailyScores, goals, pillars, tasks, taskCompletions } from "@/lib/db";
import { eq, and, gte, lte, asc, isNotNull } from "drizzle-orm";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const cycleId = parseInt(id);

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

  // Get goal progress from TaskCompletions instead of outcomeLogs
  const outcomeIds = cycleOutcomes.map(o => o.id);
  let allLogs: { outcomeId: number; value: number; date: string }[] = [];
  if (outcomeIds.length > 0) {
    const completionsForGoals = await db
      .select({
        goalId: tasks.goalId,
        value: taskCompletions.value,
        date: taskCompletions.date,
      })
      .from(taskCompletions)
      .innerJoin(tasks, eq(taskCompletions.taskId, tasks.id))
      .where(and(
        eq(taskCompletions.userId, session.user.id),
        eq(taskCompletions.completed, true),
        eq(tasks.isActive, true),
        isNotNull(tasks.goalId),
      ))
      .orderBy(asc(taskCompletions.date));

    allLogs = completionsForGoals
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
        progress: Math.max(0, Math.min(100,
          Math.abs(l.value - o.startValue) / Math.abs(o.targetValue - o.startValue) * 100
        )),
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
    .where(and(eq(pillars.userId, session.user.id), eq(pillars.isArchived, false)));

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
}
