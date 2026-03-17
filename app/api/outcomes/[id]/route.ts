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
    if (body.logFrequency !== undefined) updateData.logFrequency = body.logFrequency;
    if (body.startDate !== undefined) updateData.startDate = body.startDate || null;
    if (body.targetDate !== undefined) updateData.targetDate = body.targetDate || null;
    if (body.periodId !== undefined) updateData.periodId = body.periodId || null;
    if (body.goalType !== undefined) updateData.goalType = body.goalType;
    if (body.scheduleDays !== undefined) updateData.scheduleDays = body.scheduleDays ? JSON.stringify(body.scheduleDays) : null;
    if (body.autoCreateTasks !== undefined) updateData.autoCreateTasks = body.autoCreateTasks;
    if (body.completionType !== undefined) updateData.completionType = body.completionType;
    if (body.dailyTarget !== undefined) updateData.dailyTarget = body.dailyTarget ?? null;

    const [updated] = await db
      .update(goals)
      .set(updateData)
      .where(and(eq(goals.id, outcomeId), eq(goals.userId, userId)))
      .returning();

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
