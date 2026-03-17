import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, goals, pillars, tasks } from "@/lib/db";
import { eq, and, isNotNull, inArray } from "drizzle-orm";
import { calculateMomentum, calculateTrajectory } from "@/lib/momentum";

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();

    const today = new Date().toISOString().split("T")[0];

    // Fetch goals and pillars in parallel
    const [userGoals, userPillars] = await Promise.all([
      db
        .select()
        .from(goals)
        .where(and(eq(goals.userId, userId), eq(goals.isArchived, false))),
      db
        .select()
        .from(pillars)
        .where(and(eq(pillars.userId, userId), eq(pillars.isArchived, false))),
    ]);

    // Get logs from completed tasks linked to goals
    const goalIds = userGoals.map(g => g.id);
    let logs: { outcomeId: number; value: number; loggedAt: string }[] = [];
    if (goalIds.length > 0) {
      const allGoalTasks = await db
        .select({
          goalId: tasks.goalId,
          value: tasks.value,
          date: tasks.date,
        })
        .from(tasks)
        .where(and(
          eq(tasks.userId, userId),
          eq(tasks.completed, true),
          eq(tasks.isActive, true),
          isNotNull(tasks.goalId),
          inArray(tasks.goalId, goalIds),
        ));

      logs = allGoalTasks.map(c => ({
        outcomeId: c.goalId!,
        value: c.value ?? 0,
        loggedAt: c.date + "T12:00:00.000Z",
      }));
    }

    const pillarWeights = userPillars.map(p => ({ pillarId: p.id, weight: p.weight }));

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
      const goal = userGoals.find(og => og.id === g.goalId);
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
      const goal = userGoals.find(og => og.id === g.goalId);
      return {
        ...g,
        name: goal?.name || '',
        currentValue: goal?.currentValue || 0,
        targetValue: goal?.targetValue || 0,
        unit: goal?.unit || '',
      };
    });

    // Return null for overall when there are no goals, so the UI hides the stat
    const hasMomentumGoals = userGoals.some(g => g.goalType === 'habitual' || g.goalType === 'target');
    const hasOutcomeGoals = userGoals.some(g => g.goalType === 'outcome');

    return NextResponse.json({
      overall: hasMomentumGoals ? summary.overall : null,
      pillars: pillarInfo,
      goals: goalDetails,
      trajectory: {
        overall: hasOutcomeGoals ? trajectorySummary.overall : null,
        goals: trajectoryDetails,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
