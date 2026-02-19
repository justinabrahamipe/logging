import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, weeklyTargets, twelveWeekGoals, twelveWeekYears } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getWeekScore, redistributeTargets, getCurrentWeekNumber } from "@/lib/twelve-week-scoring";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const periodId = parseInt(id);

  const targets = await db
    .select()
    .from(weeklyTargets)
    .where(and(eq(weeklyTargets.periodId, periodId), eq(weeklyTargets.userId, session.user.id)));

  return NextResponse.json(targets);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const periodId = parseInt(id);
  const body = await request.json();
  const { updates } = body as {
    updates: { goalId: number; weekNumber: number; actualValue?: number; targetValue?: number; isOverridden?: boolean }[];
  };

  if (!updates || !Array.isArray(updates)) {
    return NextResponse.json({ error: "Missing updates array" }, { status: 400 });
  }

  // Get cycle for current week calc
  const [cycle] = await db
    .select()
    .from(twelveWeekYears)
    .where(and(eq(twelveWeekYears.id, periodId), eq(twelveWeekYears.userId, session.user.id)));

  if (!cycle) {
    return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
  }

  const currentWeek = getCurrentWeekNumber(cycle.startDate);

  // Apply each update
  for (const u of updates) {
    const updateData: Record<string, unknown> = {};
    if (u.actualValue !== undefined) updateData.actualValue = u.actualValue;
    if (u.targetValue !== undefined) updateData.targetValue = u.targetValue;
    if (u.isOverridden !== undefined) updateData.isOverridden = u.isOverridden;

    // Calculate score if actual provided
    if (u.actualValue !== undefined) {
      const [target] = await db
        .select()
        .from(weeklyTargets)
        .where(
          and(
            eq(weeklyTargets.goalId, u.goalId),
            eq(weeklyTargets.weekNumber, u.weekNumber),
            eq(weeklyTargets.userId, session.user.id)
          )
        );
      if (target) {
        const targetVal = u.targetValue !== undefined ? u.targetValue : target.targetValue;
        updateData.score = getWeekScore(u.actualValue, targetVal);
        updateData.reviewedAt = new Date();
      }
    }

    await db
      .update(weeklyTargets)
      .set(updateData)
      .where(
        and(
          eq(weeklyTargets.goalId, u.goalId),
          eq(weeklyTargets.weekNumber, u.weekNumber),
          eq(weeklyTargets.userId, session.user.id)
        )
      );
  }

  // After updates, redistribute missed targets per goal
  const affectedGoalIds = [...new Set(updates.map((u) => u.goalId))];

  for (const goalId of affectedGoalIds) {
    const allTargets = await db
      .select()
      .from(weeklyTargets)
      .where(eq(weeklyTargets.goalId, goalId));

    const redistribution = redistributeTargets(allTargets, currentWeek);
    for (const r of redistribution) {
      await db
        .update(weeklyTargets)
        .set({ targetValue: r.targetValue })
        .where(
          and(
            eq(weeklyTargets.goalId, goalId),
            eq(weeklyTargets.weekNumber, r.weekNumber)
          )
        );
    }

    // Update goal currentValue (sum of actuals)
    const totalActual = allTargets.reduce((sum, t) => {
      const updated = updates.find((u) => u.goalId === goalId && u.weekNumber === t.weekNumber);
      return sum + (updated?.actualValue !== undefined ? updated.actualValue : t.actualValue);
    }, 0);

    await db
      .update(twelveWeekGoals)
      .set({ currentValue: totalActual })
      .where(eq(twelveWeekGoals.id, goalId));
  }

  // Return updated targets
  const result = await db
    .select()
    .from(weeklyTargets)
    .where(and(eq(weeklyTargets.periodId, periodId), eq(weeklyTargets.userId, session.user.id)));

  return NextResponse.json(result);
}
