import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, goals, tasks, taskSchedules } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();

    const { id } = await params;
    const outcomeId = parseInt(id);
    const body = await request.json();

    const existing = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, outcomeId), eq(goals.userId, userId)));

    if (existing.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.pillarId !== undefined) updateData.pillarId = body.pillarId || null;
    if (body.targetValue !== undefined) updateData.targetValue = body.targetValue;
    if (body.unit !== undefined) updateData.unit = body.unit;
    if (body.direction !== undefined) updateData.direction = body.direction;
    if (body.startDate !== undefined) updateData.startDate = body.startDate || null;
    if (body.targetDate !== undefined) updateData.targetDate = body.targetDate || null;
    if (body.periodId !== undefined) updateData.periodId = body.periodId || null;
    if (body.goalType !== undefined) updateData.goalType = body.goalType;
    if (body.scheduleDays !== undefined) updateData.scheduleDays = body.scheduleDays ? JSON.stringify(body.scheduleDays) : null;
    if (body.autoCreateTasks !== undefined) updateData.autoCreateTasks = body.autoCreateTasks;
    if (body.completionType !== undefined) updateData.completionType = body.completionType;
    if (body.dailyTarget !== undefined) updateData.dailyTarget = body.dailyTarget ?? null;
    if (body.flexibilityRule !== undefined) updateData.flexibilityRule = body.flexibilityRule;
    if (body.limitValue !== undefined) updateData.limitValue = body.limitValue ?? null;

    const [updated] = await db
      .update(goals)
      .set(updateData)
      .where(and(eq(goals.id, outcomeId), eq(goals.userId, userId)))
      .returning();

    // Propagate changes to linked uncompleted tasks and their schedules
    const propagateToTasks: Record<string, unknown> = {};
    const propagateToSchedules: Record<string, unknown> = {};
    if (body.name !== undefined) { propagateToTasks.name = body.name; propagateToSchedules.name = body.name; }
    if (body.pillarId !== undefined) { propagateToTasks.pillarId = body.pillarId || null; propagateToSchedules.pillarId = body.pillarId || null; }
    if (body.completionType !== undefined) { propagateToTasks.completionType = body.completionType; propagateToSchedules.completionType = body.completionType; }
    if (body.unit !== undefined) { propagateToTasks.unit = body.unit || null; propagateToSchedules.unit = body.unit || null; }
    if (body.flexibilityRule !== undefined) { propagateToTasks.flexibilityRule = body.flexibilityRule; propagateToSchedules.flexibilityRule = body.flexibilityRule; }
    if (body.limitValue !== undefined) { propagateToTasks.limitValue = body.limitValue ?? null; propagateToSchedules.limitValue = body.limitValue ?? null; }
    if (body.periodId !== undefined) { propagateToTasks.periodId = body.periodId || null; propagateToSchedules.periodId = body.periodId || null; }

    const todayStr = new Date().toISOString().split('T')[0];

    if (Object.keys(propagateToTasks).length > 0) {
      const linkedTasks = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.goalId, outcomeId), eq(tasks.userId, userId), eq(tasks.completed, false)));

      for (const t of linkedTasks) {
        if (t.date >= todayStr) {
          await db.update(tasks).set(propagateToTasks).where(eq(tasks.id, t.id));
        }
      }
    }

    if (Object.keys(propagateToSchedules).length > 0) {
      await db
        .update(taskSchedules)
        .set(propagateToSchedules)
        .where(and(eq(taskSchedules.goalId, outcomeId), eq(taskSchedules.userId, userId)));
    }

    return NextResponse.json(updated);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();

    const { id } = await params;
    const outcomeId = parseInt(id);

    // Delete all tasks and schedules linked to this goal
    await db
      .delete(tasks)
      .where(and(eq(tasks.goalId, outcomeId), eq(tasks.userId, userId)));
    await db
      .delete(taskSchedules)
      .where(and(eq(taskSchedules.goalId, outcomeId), eq(taskSchedules.userId, userId)));

    const deleted = await db
      .delete(goals)
      .where(and(eq(goals.id, outcomeId), eq(goals.userId, userId)))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
