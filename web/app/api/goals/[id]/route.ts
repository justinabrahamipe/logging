import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse, parseId } from "@/lib/api-utils";
import { db, goals, tasks, taskSchedules } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { createAutoLog, logGoalStatusChange } from "@/lib/auto-log";
import { getTodayString } from "@/lib/format";
import { deleteFutureUncompletedTasks, regenerateGoalTasksIfNeeded } from "@/lib/goal-mutations";
import { invalidateTaskCache, ensureUpcomingTasks } from "@/lib/ensure-upcoming-tasks";
import { getOwnedGoal } from "@/lib/db-utils";
import { mapGoalUpdateFields, buildGoalPropagationPair } from "@/lib/goal-utils";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();

    const { id } = await params;
    const outcomeId = parseId(id);
    const body = await request.json();

    const existing = await getOwnedGoal(outcomeId, userId);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isProject = existing.goalType === 'project';

    const updateData = mapGoalUpdateFields(body);

    // Project goals never auto-create daily tasks — their subtasks are added by the user.
    if (isProject) updateData.autoCreateTasks = false;

    // When marking a target/outcome goal as complete, set currentValue = targetValue
    if (body.status === 'completed' && (existing.goalType === 'target' || existing.goalType === 'outcome')) {
      updateData.currentValue = existing.targetValue;
    }

    const [updated] = await db
      .update(goals)
      .set(updateData)
      .where(and(eq(goals.id, outcomeId), eq(goals.userId, userId)))
      .returning();

    const todayStr = getTodayString();

    // When goal is completed/abandoned, or autoCreateTasks is turned off, delete future uncompleted tasks
    if (body.status === 'completed' || body.status === 'abandoned') {
      await deleteFutureUncompletedTasks(outcomeId, userId);
    }
    if (body.autoCreateTasks === false && existing.autoCreateTasks) {
      await deleteFutureUncompletedTasks(outcomeId, userId);
    }

    // Status changes must invalidate the upcoming-tasks cache so schedules
    // tied to this goal either stop regenerating (abandon/complete) or resume
    // regenerating (reactivate) on the next GET /api/tasks.
    if (body.status && body.status !== existing.status) {
      invalidateTaskCache(userId);
      // On reactivate, run the generator right away so schedule-based tasks
      // come back before the client refetches.
      if (body.status === 'active' && existing.status !== 'active') {
        await ensureUpcomingTasks(userId);
      }
    }

    // Prune stale tasks and (re)generate for range/schedule changes
    await regenerateGoalTasksIfNeeded(outcomeId, userId, existing, body, updated);

    // Propagate changes to linked uncompleted tasks and their schedules
    const { tasks: propagateToTasks, schedules: propagateToSchedules } = buildGoalPropagationPair(body, existing.goalType);

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

    await logGoalStatusChange(userId, existing, body);

    return NextResponse.json(updated);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();

    const { id } = await params;
    const outcomeId = parseId(id);

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

    await createAutoLog(userId, `🗑️ Goal deleted: ${deleted[0].name}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
