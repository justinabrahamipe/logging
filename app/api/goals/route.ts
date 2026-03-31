import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, goals, pillars, cycles } from "@/lib/db";
import { eq } from "drizzle-orm";
import { createAutoLog } from "@/lib/auto-log";
import { generateGoalTasks } from "@/lib/ensure-upcoming-tasks";

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();

    const result = await db
      .select({
        id: goals.id,
        userId: goals.userId,
        pillarId: goals.pillarId,
        name: goals.name,
        startValue: goals.startValue,
        targetValue: goals.targetValue,
        currentValue: goals.currentValue,
        unit: goals.unit,
        startDate: goals.startDate,
        targetDate: goals.targetDate,
        periodId: goals.periodId,
        goalType: goals.goalType,
        scheduleDays: goals.scheduleDays,
        autoCreateTasks: goals.autoCreateTasks,
        completionType: goals.completionType,
        dailyTarget: goals.dailyTarget,
        flexibilityRule: goals.flexibilityRule,
        limitValue: goals.limitValue,
        basePoints: goals.basePoints,
        status: goals.status,
        createdAt: goals.createdAt,
        updatedAt: goals.updatedAt,
        pillarName: pillars.name,
        pillarColor: pillars.color,
        pillarEmoji: pillars.emoji,
      })
      .from(goals)
      .leftJoin(pillars, eq(goals.pillarId, pillars.id))
      .where(eq(goals.userId, userId));

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();

    const body = await request.json();
    const { name, targetValue, unit, pillarId, periodId, goalType, completionType, dailyTarget, scheduleDays, autoCreateTasks, flexibilityRule, limitValue, basePoints } = body;

    const isActivityGoal = goalType === 'habitual' || goalType === 'target';

    if (!name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!isActivityGoal && (targetValue == null || !unit)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // For activity goals, derive dates from the linked cycle
    let effectiveStartDate = body.startDate || null;
    let effectiveTargetDate = body.targetDate || null;

    if (isActivityGoal && periodId) {
      const [cycle] = await db.select().from(cycles).where(eq(cycles.id, parseInt(periodId)));
      if (cycle) {
        if (!effectiveStartDate) effectiveStartDate = cycle.startDate;
        if (!effectiveTargetDate) effectiveTargetDate = cycle.endDate;
      }
    }

    const effectiveStartValue = body.startValue ?? 0;

    const [outcome] = await db.insert(goals).values({
      userId,
      name,
      startValue: effectiveStartValue,
      targetValue: targetValue ?? 0,
      currentValue: effectiveStartValue,
      unit: unit || 'days',
      pillarId: pillarId || null,
      startDate: effectiveStartDate,
      targetDate: effectiveTargetDate,
      periodId: periodId || null,
      goalType: goalType || 'outcome',
      completionType: completionType || 'checkbox',
      dailyTarget: dailyTarget ?? null,
      scheduleDays: scheduleDays ? JSON.stringify(scheduleDays) : null,
      autoCreateTasks: autoCreateTasks || false,
      flexibilityRule: flexibilityRule || 'must_today',
      limitValue: limitValue ?? null,
      basePoints: basePoints ?? 10,
    }).returning();

    // Generate all tasks upfront for the full goal date range
    if (autoCreateTasks) {
      await generateGoalTasks(userId, outcome.id);
    }

    await createAutoLog(userId, `📌 Goal created: ${name}`);
    return NextResponse.json(outcome, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
