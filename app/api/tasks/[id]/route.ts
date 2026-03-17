import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, tasks, taskSchedules } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();

    const { id } = await params;
    const taskId = parseInt(id);

    // Check if this is a schedule ID (for edit views) or task instance ID
    const type = new URL(request.url).searchParams.get('type');

    if (type === 'schedule') {
      const [schedule] = await db
        .select()
        .from(taskSchedules)
        .where(and(eq(taskSchedules.id, taskId), eq(taskSchedules.userId, userId), eq(taskSchedules.isActive, true)));

      if (!schedule) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(schedule);
    }

    // Default: look up as task instance first, then fall back to schedule
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId), eq(tasks.isActive, true)));

    if (task) {
      return NextResponse.json(task);
    }

    // Fall back to schedule lookup
    const [schedule] = await db
      .select()
      .from(taskSchedules)
      .where(and(eq(taskSchedules.id, taskId), eq(taskSchedules.userId, userId), eq(taskSchedules.isActive, true)));

    if (!schedule) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(schedule);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();

    const { id } = await params;
    const itemId = parseInt(id);
    const body = await request.json();

    // Check if updating a task instance (e.g., moving date) or a schedule
    const type = new URL(request.url).searchParams.get('type');

    if (type === 'task') {
      // Update a specific task instance
      const updateData: Record<string, unknown> = {};
      const taskFields = ['name', 'pillarId', 'completionType', 'target', 'unit', 'basePoints', 'isActive', 'goalId', 'periodId', 'date'];
      for (const field of taskFields) {
        if (body[field] !== undefined) updateData[field] = body[field];
      }

      const [updated] = await db
        .update(tasks)
        .set(updateData)
        .where(and(eq(tasks.id, itemId), eq(tasks.userId, userId)))
        .returning();

      if (!updated) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(updated);
    }

    // Default: update schedule and propagate to uncompleted future task instances
    const existing = await db
      .select()
      .from(taskSchedules)
      .where(and(eq(taskSchedules.id, itemId), eq(taskSchedules.userId, userId)));

    if (existing.length === 0) {
      // Try as task instance (backward compat for adhoc task date moves)
      const [taskInstance] = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, itemId), eq(tasks.userId, userId)));

      if (!taskInstance) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      // Update the task instance directly
      const updateData: Record<string, unknown> = {};
      if (body.startDate !== undefined) updateData.date = body.startDate;
      if (body.name !== undefined) updateData.name = body.name;
      if (body.isActive !== undefined) updateData.isActive = body.isActive;

      const [updated] = await db
        .update(tasks)
        .set(updateData)
        .where(and(eq(tasks.id, itemId), eq(tasks.userId, userId)))
        .returning();

      // Also update the schedule if it exists
      if (taskInstance.scheduleId) {
        const scheduleUpdate: Record<string, unknown> = {};
        if (body.startDate !== undefined) scheduleUpdate.startDate = body.startDate;
        if (body.name !== undefined) scheduleUpdate.name = body.name;
        if (body.isActive !== undefined) scheduleUpdate.isActive = body.isActive;
        if (Object.keys(scheduleUpdate).length > 0) {
          await db.update(taskSchedules).set(scheduleUpdate)
            .where(eq(taskSchedules.id, taskInstance.scheduleId));
        }
      }

      return NextResponse.json(updated);
    }

    const updateData: Record<string, unknown> = {};
    const fields = ['name', 'pillarId', 'completionType', 'target', 'unit', 'flexibilityRule', 'frequency', 'customDays', 'repeatInterval', 'basePoints', 'isActive', 'limitValue', 'goalId', 'periodId', 'startDate'];

    for (const field of fields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const [updated] = await db
      .update(taskSchedules)
      .set(updateData)
      .where(and(eq(taskSchedules.id, itemId), eq(taskSchedules.userId, userId)))
      .returning();

    // Propagate name/pillar/completionType changes to uncompleted future task instances
    const todayStr = new Date().toISOString().split('T')[0];
    const propagateFields: Record<string, unknown> = {};
    for (const field of ['name', 'pillarId', 'completionType', 'target', 'unit', 'basePoints', 'flexibilityRule', 'limitValue']) {
      if (body[field] !== undefined) propagateFields[field] = body[field];
    }
    if (Object.keys(propagateFields).length > 0) {
      // Update future uncompleted task instances
      const futureTasks = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.scheduleId, itemId), eq(tasks.userId, userId), eq(tasks.completed, false)));

      for (const ft of futureTasks) {
        if (ft.date >= todayStr) {
          await db.update(tasks).set(propagateFields).where(eq(tasks.id, ft.id));
        }
      }
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
    const itemId = parseInt(id);

    // Try deleting as schedule first
    const deletedSchedule = await db
      .delete(taskSchedules)
      .where(and(eq(taskSchedules.id, itemId), eq(taskSchedules.userId, userId)))
      .returning();

    if (deletedSchedule.length > 0) {
      // Also delete all task instances for this schedule
      await db.delete(tasks).where(and(eq(tasks.scheduleId, itemId), eq(tasks.userId, userId)));
      return NextResponse.json({ success: true });
    }

    // Try as task instance
    const deleted = await db
      .delete(tasks)
      .where(and(eq(tasks.id, itemId), eq(tasks.userId, userId)))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
