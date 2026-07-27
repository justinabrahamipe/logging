import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, goals, pillars, cycles } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getGoalBadge } from "@/lib/goal-badge";

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();

    const today = new Date().toISOString().split("T")[0];

    // Fetch goals, pillars, and cycles in parallel
    const [allUserGoals, userPillars, userCycles] = await Promise.all([
      db
        .select()
        .from(goals)
        .where(eq(goals.userId, userId)),
      db
        .select()
        .from(pillars)
        .where(eq(pillars.userId, userId)),
      db
        .select()
        .from(cycles)
        .where(eq(cycles.userId, userId)),
    ]);

    // Match dashboard GoalProgress visibility: only goals that are active and either
    // unattached to a cycle or attached to an active cycle. Stale/archived goals
    // shouldn't drag the trajectory average.
    const activeCycleIds = new Set(
      userCycles
        .filter(c => c.startDate <= today && c.endDate >= today)
        .map(c => c.id)
    );
    const userGoals = allUserGoals.filter(g =>
      g.status === 'active' && (g.periodId == null || activeCycleIds.has(g.periodId))
    );

    const mappedGoals = userGoals.map(g => ({
      id: g.id,
      goalType: g.goalType,
      pillarId: g.pillarId,
      targetValue: g.targetValue,
      startValue: g.startValue,
      currentValue: g.currentValue,
      startDate: g.startDate,
      targetDate: g.targetDate,
      scheduleDays: g.scheduleDays,
      flexibilityRule: g.flexibilityRule,
      limitValue: g.limitValue,
      dailyTarget: g.dailyTarget,
      completionType: g.completionType,
    }));

    // Compute badges using shared getGoalBadge for consistency
    const goalDetails: { goalId: number; goalType: string; pillarId: number | null; momentum: number; label: string; name: string; currentValue: number; targetValue: number; unit: string }[] = [];
    const trajectoryDetails: { goalId: number; pillarId: number | null; trajectory: number; label: string; name: string; currentValue: number; targetValue: number; unit: string }[] = [];
    const pillarMomentum: Record<number, number[]> = {};

    for (const g of mappedGoals) {
      const badge = getGoalBadge(g, today);
      const goal = userGoals.find(og => og.id === g.id);
      if (!badge) continue;

      if (g.goalType === 'target') {
        goalDetails.push({
          goalId: g.id, goalType: g.goalType, pillarId: g.pillarId,
          momentum: badge.value, label: badge.label,
          name: goal?.name || '', currentValue: g.currentValue, targetValue: g.targetValue, unit: goal?.unit || '',
        });
        const pid = g.pillarId ?? 0;
        if (!pillarMomentum[pid]) pillarMomentum[pid] = [];
        pillarMomentum[pid].push(badge.value);
      } else if (g.goalType === 'outcome') {
        trajectoryDetails.push({
          goalId: g.id, pillarId: g.pillarId,
          trajectory: badge.value, label: badge.label,
          name: goal?.name || '', currentValue: g.currentValue, targetValue: g.targetValue, unit: goal?.unit || '',
        });
      }
    }

    // Pillar aggregation
    const pillarInfo = userPillars.map(p => ({
      id: p.id, name: p.name, emoji: p.emoji, color: p.color, defaultBasePoints: p.defaultBasePoints,
      momentum: pillarMomentum[p.id] ? Math.round(pillarMomentum[p.id].reduce((a, b) => a + b, 0) / pillarMomentum[p.id].length * 100) / 100 : null,
    }));

    const overallMomentum = goalDetails.length > 0
      ? Math.round(goalDetails.reduce((s, g) => s + g.momentum, 0) / goalDetails.length * 100) / 100
      : null;
    const overallTrajectory = trajectoryDetails.length > 0
      ? Math.round(trajectoryDetails.reduce((s, g) => s + g.trajectory, 0) / trajectoryDetails.length * 100) / 100
      : null;

    return NextResponse.json({
      overall: overallMomentum,
      pillars: pillarInfo,
      goals: goalDetails,
      trajectory: {
        overall: overallTrajectory,
        goals: trajectoryDetails,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
