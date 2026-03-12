import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, goals, pillars, tasks, taskCompletions } from "@/lib/db";
import { eq, and, isNotNull, inArray } from "drizzle-orm";
import { calculateMomentum, calculateTrajectory } from "@/lib/momentum";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];

  // Fetch goals and pillars in parallel
  const [userGoals, userPillars] = await Promise.all([
    db
      .select()
      .from(goals)
      .where(and(eq(goals.userId, session.user.id), eq(goals.isArchived, false))),
    db
      .select()
      .from(pillars)
      .where(and(eq(pillars.userId, session.user.id), eq(pillars.isArchived, false))),
  ]);

  // Get logs from TaskCompletions joined with Tasks
  const goalIds = userGoals.map(g => g.id);
  let logs: { outcomeId: number; value: number; loggedAt: string }[] = [];
  if (goalIds.length > 0) {
    const allCompletions = await db
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
        isNotNull(tasks.goalId),
        inArray(tasks.goalId, goalIds),
      ));

    logs = allCompletions.map(c => ({
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
