import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, goals, pillars, cycles } from "@/lib/db";
import { eq } from "drizzle-orm";
import { createAutoLog } from "@/lib/auto-log";
import { generateGoalTasks } from "@/lib/ensure-upcoming-tasks";
import { goalCreateSchema, applyGoalDbTransforms } from "@/lib/schemas/goal";

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

    // Validate via the shared schema (single source of truth with MCP and edit endpoints)
    const result = goalCreateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid input", details: result.error.issues }, { status: 400 });
    }
    const data = result.data;

    const goalType = data.goalType ?? 'outcome';
    const isActivityGoal = goalType === 'habitual' || goalType === 'target';
    const isProject = goalType === 'project';

    // outcome/target need an explicit target + unit; project starts at 0 and grows with subtasks
    if (!isActivityGoal && !isProject && (data.targetValue == null || !data.unit)) {
      return NextResponse.json({ error: "outcome/target goals require targetValue and unit" }, { status: 400 });
    }

    // For activity goals, derive dates from the linked cycle
    let effectiveStartDate = data.startDate || null;
    let effectiveTargetDate = data.targetDate || null;
    if (isActivityGoal && data.periodId) {
      const [cycle] = await db.select().from(cycles).where(eq(cycles.id, data.periodId));
      if (cycle) {
        if (!effectiveStartDate) effectiveStartDate = cycle.startDate;
        if (!effectiveTargetDate) effectiveTargetDate = cycle.endDate;
      }
    }

    const startValue = data.startValue ?? 0;
    const transformed = applyGoalDbTransforms(data);

    const [outcome] = await db.insert(goals).values({
      userId,
      name: data.name,
      startValue,
      targetValue: data.targetValue ?? 0,
      currentValue: startValue,
      unit: data.unit || (isProject ? 'steps' : 'days'),
      pillarId: (transformed.pillarId as number | null) ?? null,
      startDate: effectiveStartDate,
      targetDate: effectiveTargetDate,
      periodId: (transformed.periodId as number | null) ?? null,
      goalType,
      completionType: data.completionType || 'checkbox',
      dailyTarget: data.dailyTarget ?? null,
      scheduleDays: (transformed.scheduleDays as string | null) ?? null,
      autoCreateTasks: isProject ? false : (data.autoCreateTasks || false),
      flexibilityRule: data.flexibilityRule || 'must_today',
      limitValue: data.limitValue ?? null,
      basePoints: data.basePoints ?? 10,
    }).returning();

    // Generate all tasks upfront for the full goal date range
    if (!isProject && data.autoCreateTasks) {
      await generateGoalTasks(userId, outcome.id);
    }

    await createAutoLog(userId, `📌 Goal created: ${data.name}`);
    return NextResponse.json(outcome, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
