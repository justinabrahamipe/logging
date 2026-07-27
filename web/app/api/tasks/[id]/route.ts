import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse, parseId } from "@/lib/api-utils";
import { db, tasks, taskSchedules } from "@/lib/db";
import { invalidateTaskCache } from "@/lib/ensure-upcoming-tasks";
import { eq, and } from "drizzle-orm";
import { createAutoLog } from "@/lib/auto-log";
import { recalculateDateScores } from "@/lib/save-daily-score";
import { getTodayString } from "@/lib/format";
import { getOwnedTask, getOwnedSchedule } from "@/lib/db-utils";
import { mapTaskUpdateFields, mapScheduleUpdateFields, buildTaskPropagationFields } from "@/lib/task-utils";
import { isTaskTooOldToEdit, dismissOrDeleteTask } from "@/lib/task-mutations";
import { recalculateGoalCurrentValue } from "@/lib/goal-mutations";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();

    const { id } = await params;
    const taskId = parseId(id);

    // Check if this is a schedule ID (for edit views) or task instance ID
    const type = new URL(request.url).searchParams.get('type');

    if (type === 'schedule') {
      const [schedule] = await db
        .select()
        .from(taskSchedules)
        .where(and(eq(taskSchedules.id, taskId), eq(taskSchedules.userId, userId)));

      if (!schedule) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(schedule);
    }

    // Default: look up as task instance first, then fall back to schedule
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

    if (task) {
      // Merge schedule data (frequency, customDays, repeatInterval) if available
      if (task.scheduleId) {
        const [schedule] = await db
          .select({ frequency: taskSchedules.frequency, customDays: taskSchedules.customDays, repeatInterval: taskSchedules.repeatInterval, endDate: taskSchedules.endDate })
          .from(taskSchedules)
          .where(eq(taskSchedules.id, task.scheduleId));
        if (schedule) {
          return NextResponse.json({ ...task, ...schedule });
        }
      }
      return NextResponse.json({ ...task, frequency: 'adhoc', customDays: null, repeatInterval: null });
    }

    // Fall back to schedule lookup
    const [schedule] = await db
      .select()
      .from(taskSchedules)
      .where(and(eq(taskSchedules.id, taskId), eq(taskSchedules.userId, userId)));

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
    const itemId = parseId(id);
    const body = await request.json();

    // Check if updating a task instance (e.g., moving date) or a schedule
    const type = new URL(request.url).searchParams.get('type');

    if (type === 'task') {
      // Update a specific task instance
      const existing = await getOwnedTask(itemId, userId);
      if (!existing) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      // Only allow edits for today, yesterday, and future — older tasks are frozen (no-date tasks are always editable)
      // Use client-provided date to derive yesterday (avoids server timezone mismatch)
      const refDate = body.date || body.startDate || existing.date;
      if (isTaskTooOldToEdit(existing.date, refDate)) {
        return NextResponse.json({ error: "Cannot modify tasks older than yesterday" }, { status: 403 });
      }

      const updateData = mapTaskUpdateFields(body);

      // Track original date on first postpone/prepone — so adhoc tasks (which
      // don't get originalDate at creation) also show the "Originally" cell.
      if (
        typeof updateData.date === 'string' &&
        updateData.date !== existing.date &&
        !existing.originalDate &&
        existing.date
      ) {
        updateData.originalDate = existing.date;
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
    const existing = await getOwnedSchedule(itemId, userId);

    if (!existing) {
      // Try as task instance (adhoc tasks are stored directly without schedules)
      const taskInstance = await getOwnedTask(itemId, userId);
      if (!taskInstance) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      // Update the task instance directly. body.startDate maps to task.date here.
      const taskBody = { ...body, date: body.startDate !== undefined ? (body.startDate || '') : body.date };
      const updateData = mapTaskUpdateFields(taskBody);

      const [updated] = await db
        .update(tasks)
        .set(updateData)
        .where(and(eq(tasks.id, itemId), eq(tasks.userId, userId)))
        .returning();

      // Recalculate scores for old and new date when task is moved
      if (body.startDate !== undefined) {
        await recalculateDateScores(userId, taskInstance.date, body.startDate);
      }

      // Also update the schedule if it exists
      if (taskInstance.scheduleId) {
        const scheduleUpdate = mapScheduleUpdateFields(body);
        if (Object.keys(scheduleUpdate).length > 0) {
          await db.update(taskSchedules).set(scheduleUpdate)
            .where(eq(taskSchedules.id, taskInstance.scheduleId));
        }
      }

      return NextResponse.json(updated);
    }

    const updateData = mapScheduleUpdateFields(body);

    const [updated] = await db
      .update(taskSchedules)
      .set(updateData)
      .where(and(eq(taskSchedules.id, itemId), eq(taskSchedules.userId, userId)))
      .returning();

    // Propagate to uncompleted future task instances
    const todayStr = getTodayString();
    const propagateFields = buildTaskPropagationFields(body);
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
    const itemId = parseId(id);

    // Check if this is a schedule
    const [schedule] = await db
      .select({ id: taskSchedules.id })
      .from(taskSchedules)
      .where(and(eq(taskSchedules.id, itemId), eq(taskSchedules.userId, userId)));

    if (schedule) {
      // Delete task instances FIRST (before schedule, since FK onDelete sets scheduleId to null)
      await db.delete(tasks).where(and(eq(tasks.scheduleId, itemId), eq(tasks.userId, userId)));
      await db.delete(taskSchedules).where(eq(taskSchedules.id, itemId));
      invalidateTaskCache(userId);
      return NextResponse.json({ success: true });
    }

    // Try as task instance
    const taskInstance = await getOwnedTask(itemId, userId);
    if (!taskInstance) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await createAutoLog(userId, `🗑️ Task deleted: ${taskInstance.name}`);
    await dismissOrDeleteTask(itemId, userId, taskInstance.goalId, taskInstance.scheduleId);

    // Recalculate linked goal's currentValue after task deletion
    if (taskInstance.goalId && (taskInstance.completed || (taskInstance.value ?? 0) > 0)) {
      await recalculateGoalCurrentValue(taskInstance.goalId, userId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
