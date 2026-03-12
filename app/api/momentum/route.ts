import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, outcomes, outcomeLogs, pillars } from "@/lib/db";
import { eq, and, inArray } from "drizzle-orm";
import { calculateMomentum, calculateTrajectory } from "@/lib/momentum";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];

  // Fetch goals and pillars in parallel
  const [goals, userPillars] = await Promise.all([
    db
      .select()
      .from(outcomes)
      .where(and(eq(outcomes.userId, session.user.id), eq(outcomes.isArchived, false))),
    db
      .select()
      .from(pillars)
      .where(and(eq(pillars.userId, session.user.id), eq(pillars.isArchived, false))),
  ]);

  // Get logs filtered by active goal IDs in the DB
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
      .where(and(eq(outcomeLogs.userId, session.user.id), inArray(outcomeLogs.outcomeId, goalIds)));

    logs = allLogs.map(l => ({
      outcomeId: l.outcomeId,
      value: l.value,
      loggedAt: l.loggedAt instanceof Date ? l.loggedAt.toISOString() : String(l.loggedAt),
    }));
  }

  const pillarWeights = userPillars.map(p => ({ pillarId: p.id, weight: p.weight }));

  const mappedGoals = goals.map(g => ({
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

  const summary = calculateMomentum(mappedGoals, logs, pillarWeights, today);
  const trajectorySummary = calculateTrajectory(mappedGoals, today);

  // Enrich with pillar info
  const pillarInfo = userPillars.map(p => ({
    id: p.id,
    name: p.name,
    emoji: p.emoji,
    color: p.color,
    weight: p.weight,
    momentum: summary.pillarMomentum[p.id] ?? null,
  }));

  // Enrich momentum goals with names
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

  // Enrich trajectory goals with names
  const trajectoryDetails = trajectorySummary.goals.map(g => {
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
    trajectory: {
      overall: trajectorySummary.overall,
      goals: trajectoryDetails,
    },
  });
}
