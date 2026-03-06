import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, outcomes, outcomeLogs, pillars } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { calculateMomentum } from "@/lib/momentum";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];

  // Get all active goals
  const goals = await db
    .select()
    .from(outcomes)
    .where(and(eq(outcomes.userId, session.user.id), eq(outcomes.isArchived, false)));

  // Get all logs for these goals
  const goalIds = goals.map(g => g.id);
  let logs: { outcomeId: number; value: number; loggedAt: string }[] = [];
  if (goalIds.length > 0) {
    const allLogs = await db
      .select({
        outcomeId: outcomeLogs.outcomeId,
        value: outcomeLogs.value,
        loggedAt: outcomeLogs.loggedAt,
      })
      .from(outcomeLogs)
      .where(eq(outcomeLogs.userId, session.user.id));

    logs = allLogs
      .filter(l => goalIds.includes(l.outcomeId))
      .map(l => ({
        outcomeId: l.outcomeId,
        value: l.value,
        loggedAt: l.loggedAt instanceof Date ? l.loggedAt.toISOString() : String(l.loggedAt),
      }));
  }

  // Get pillar weights
  const userPillars = await db
    .select()
    .from(pillars)
    .where(and(eq(pillars.userId, session.user.id), eq(pillars.isArchived, false)));

  const pillarWeights = userPillars.map(p => ({ pillarId: p.id, weight: p.weight }));

  const goalsForMomentum = goals.map(g => ({
    id: g.id,
    goalType: g.goalType,
    pillarId: g.pillarId,
    targetValue: g.targetValue,
    startValue: g.startValue,
    currentValue: g.currentValue,
    startDate: g.startDate,
    targetDate: g.targetDate,
    scheduleDays: g.scheduleDays,
    tolerance: g.tolerance,
  }));

  const summary = calculateMomentum(goalsForMomentum, logs, pillarWeights, today);

  // Enrich with pillar info
  const pillarInfo = userPillars.map(p => ({
    id: p.id,
    name: p.name,
    emoji: p.emoji,
    color: p.color,
    weight: p.weight,
    momentum: summary.pillarMomentum[p.id] ?? null,
  }));

  // Enrich goals with names
  const goalDetails = summary.goals.map(g => {
    const goal = goals.find(og => og.id === g.goalId);
    return {
      ...g,
      name: goal?.name || '',
      currentValue: goal?.currentValue || 0,
      targetValue: goal?.targetValue || 0,
      unit: goal?.unit || '',
    };
  });

  return NextResponse.json({
    overall: summary.overall,
    pillars: pillarInfo,
    goals: goalDetails,
  });
}
