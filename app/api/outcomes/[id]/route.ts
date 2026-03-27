import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, goals, tasks, taskSchedules } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { createAutoLog } from "@/lib/auto-log";
import { generateGoalTasks } from "@/lib/ensure-upcoming-tasks";

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
    if (body.minimumTarget !== undefined) updateData.minimumTarget = body.minimumTarget ?? null;
    if (body.status !== undefined) updateData.status = body.status;

    // When marking a target/outcome goal as complete, set currentValue = targetValue
    if (body.status === 'completed') {
      const goal = existing[0];
      if (goal.goalType === 'target' || goal.goalType === 'outcome') {
        updateData.currentValue = goal.targetValue;
      }
    }

    const [updated] = await db
      .update(goals)
      .set(updateData)
      .where(and(eq(goals.id, outcomeId), eq(goals.userId, userId)))
      .returning();

    const todayStr = new Date().toISOString().split('T')[0];

    // When goal is completed or abandoned, delete future uncompleted tasks
    if (body.status === 'completed' || body.status === 'abandoned') {
      const futureTasks = await db
        .select({ id: tasks.id, date: tasks.date })
        .from(tasks)
        .where(and(
          eq(tasks.goalId, outcomeId),
          eq(tasks.userId, userId),
          eq(tasks.completed, false),
        ));
      const futureIds = futureTasks.filter(t => t.date > todayStr).map(t => t.id);
      for (const fid of futureIds) {
        await db.delete(tasks).where(eq(tasks.id, fid));
      }
    }

    // When targetDate is preponed, delete uncompleted tasks beyond the new end date
    if (body.targetDate !== undefined && body.targetDate) {
      const beyondTasks = await db
        .select({ id: tasks.id, date: tasks.date })
        .from(tasks)
        .where(and(
          eq(tasks.goalId, outcomeId),
          eq(tasks.userId, userId),
          eq(tasks.completed, false),
        ));
      const beyondIds = beyondTasks.filter(t => t.date > body.targetDate).map(t => t.id);
      for (const fid of beyondIds) {
        await db.delete(tasks).where(eq(tasks.id, fid));
      }
    }

    // When scheduleDays changed, delete uncompleted future tasks on removed days
    if (body.scheduleDays !== undefined) {
      const newDays: number[] = body.scheduleDays || [];
      const oldDays: number[] = existing[0].scheduleDays ? JSON.parse(existing[0].scheduleDays) : [];
      const removedDays = oldDays.filter(d => !newDays.includes(d));
      if (removedDays.length > 0) {
        const futureTasks = await db
          .select({ id: tasks.id, date: tasks.date })
          .from(tasks)
          .where(and(
            eq(tasks.goalId, outcomeId),
            eq(tasks.userId, userId),
            eq(tasks.completed, false),
          ));
        for (const t of futureTasks) {
          if (t.date >= todayStr) {
            const dow = new Date(t.date + 'T12:00:00').getDay();
            if (removedDays.includes(dow)) {
              await db.delete(tasks).where(eq(tasks.id, t.id));
            }
          }
        }
      }
    }

    // When autoCreateTasks is turned off, delete all future uncompleted tasks
    if (body.autoCreateTasks === false && existing[0].autoCreateTasks) {
      const futureTasks = await db
        .select({ id: tasks.id, date: tasks.date })
        .from(tasks)
        .where(and(
          eq(tasks.goalId, outcomeId),
          eq(tasks.userId, userId),
          eq(tasks.completed, false),
        ));
      for (const t of futureTasks) {
        if (t.date > todayStr) {
          await db.delete(tasks).where(eq(tasks.id, t.id));
        }
      }
    }

    // Generate new tasks for extended range, new days, or toggled-on autoCreateTasks
    const needsRegenerate = (
      (body.targetDate !== undefined && body.targetDate > (existing[0].targetDate || '')) ||
      (body.startDate !== undefined) ||
      (body.scheduleDays !== undefined) ||
      (body.autoCreateTasks === true && !existing[0].autoCreateTasks)
    );
    if (needsRegenerate && updated.autoCreateTasks && updated.status === 'active') {
      await generateGoalTasks(userId, outcomeId);
    }

    // Propagate changes to linked uncompleted tasks and their schedules
    const propagateToTasks: Record<string, unknown> = {};
    const propagateToSchedules: Record<string, unknown> = {};
    if (body.name !== undefined) { propagateToTasks.name = body.name; propagateToSchedules.name = body.name; }
    if (body.pillarId !== undefined) { propagateToTasks.pillarId = body.pillarId || null; propagateToSchedules.pillarId = body.pillarId || null; }
    if (body.completionType !== undefined) { propagateToTasks.completionType = body.completionType; propagateToSchedules.completionType = body.completionType; }
    if (body.unit !== undefined) { propagateToTasks.unit = body.unit || null; propagateToSchedules.unit = body.unit || null; }
    if (body.flexibilityRule !== undefined) { propagateToTasks.flexibilityRule = body.flexibilityRule; propagateToSchedules.flexibilityRule = body.flexibilityRule; }
    if (body.limitValue !== undefined) { propagateToTasks.limitValue = body.limitValue ?? null; propagateToSchedules.limitValue = body.limitValue ?? null; }
    if (body.minimumTarget !== undefined) { propagateToTasks.minimumTarget = body.minimumTarget ?? null; }
    if (body.periodId !== undefined) { propagateToTasks.periodId = body.periodId || null; propagateToSchedules.periodId = body.periodId || null; }

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

    // Auto-log goal changes
    const goalName = existing[0].name;
    if (body.status === 'completed') {
      await createAutoLog(userId, `🏆 Goal completed: ${goalName}`);
    } else if (body.status === 'abandoned') {
      await createAutoLog(userId, `🚫 Goal abandoned: ${goalName}`);
    } else if (body.status === 'active' && existing[0].status !== 'active') {
      await createAutoLog(userId, `🔄 Goal reactivated: ${goalName}`);
    } else if (body.name && body.name !== goalName) {
      await createAutoLog(userId, `✏️ Goal renamed: ${goalName} → ${body.name}`);
    } else if (Object.keys(body).some(k => !['status'].includes(k))) {
      await createAutoLog(userId, `✏️ Goal updated: ${goalName}`);
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

    await createAutoLog(userId, `🗑️ Goal deleted: ${deleted[0].name}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
