import { db, tasks, activityLog, goals, locationLogs } from "@/lib/db";
import { eq, and, or, gt, like } from "drizzle-orm";
import { createAutoLog } from "@/lib/auto-log";
import { calculateTaskScore } from "@/lib/scoring";
import { saveDailyScore } from "@/lib/save-daily-score";
import { invalidateRecalcCache } from "@/lib/ensure-upcoming-tasks";

import { deleteTasksByIds } from "@/lib/db-utils";

export async function completeTask(params: {
  userId: string;
  taskId: number;
  date: string;
  completed?: boolean;
  value?: number;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<{ task: any; result: any }> {
  const { userId, taskId, date } = params;

  // Find the task (try as instance ID first, then as schedule ID + date)
  let [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

  if (!task) {
    [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.scheduleId, taskId), eq(tasks.date, date), eq(tasks.userId, userId)));
  }

  if (!task) {
    throw new Error("Task not found");
  }

  const completionValue = params.value ?? (task.completionType === 'checkbox' ? (params.completed ? 1 : 0) : 0);
  const targetReached = task.target != null && task.target > 0 && completionValue >= task.target;
  const isCompleted = params.completed ?? (
    task.completionType === 'checkbox' ? true :
    targetReached
  );

  const pointsEarned = calculateTaskScore(
    { id: task.id, pillarId: task.pillarId, completionType: task.completionType, target: task.target, basePoints: task.basePoints, flexibilityRule: task.flexibilityRule, limitValue: task.limitValue },
    { taskId: task.id, completed: isCompleted, value: completionValue }
  );

  const previousValue = task.value ?? null;
  const pointsBefore = task.pointsEarned ?? 0;

  // Update the task row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {
    completed: isCompleted,
    value: completionValue,
    pointsEarned,
    completedAt: isCompleted ? new Date() : null,
    timerStartedAt: null,
    skipped: false,
  };
  if (task.date === '' && isCompleted) {
    updateData.date = date;
  }

  const [result] = await db
    .update(tasks)
    .set(updateData)
    .where(eq(tasks.id, task.id))
    .returning();

  // Determine action type
  let action = 'complete';
  if (previousValue !== null) {
    if (completionValue > (previousValue ?? 0)) action = 'add';
    else if (completionValue < (previousValue ?? 0)) action = 'subtract';
    else action = 'adjust';
  }

  // Determine source
  const source = task.completionType === 'duration' ? 'timer' : 'manual';

  // Insert activity log entry
  await db.insert(activityLog).values({
    userId,
    taskId: task.id,
    pillarId: task.pillarId,
    action,
    previousValue,
    newValue: completionValue,
    delta: completionValue - (previousValue ?? 0),
    pointsBefore,
    pointsAfter: pointsEarned,
    pointsDelta: pointsEarned - pointsBefore,
    source,
  });

  // Auto-log task completion / remove log on undo
  try {
    const taskDate = result.date || date;
    if (isCompleted && !task.completed) {
      const valueStr = completionValue > 0 && task.completionType !== 'checkbox' ? ` (${completionValue}${task.unit ? ' ' + task.unit : ''})` : '';
      await createAutoLog(userId, `✅ ${task.name}${valueStr}`, taskDate);
    } else if (!isCompleted && task.completed) {
      const logs = await db.select().from(locationLogs).where(
        and(eq(locationLogs.userId, userId), like(locationLogs.notes, `✅ ${task.name}%`))
      );
      if (logs.length > 0) {
        await db.delete(locationLogs).where(eq(locationLogs.id, logs[logs.length - 1].id));
      }
    }
  } catch (err) {
    console.error("Failed to auto-log task:", err);
  }

  // Update linked goal's currentValue by recalculating from all completed tasks
  if (task.goalId) {
    try {
      const [linkedGoal] = await db
        .select()
        .from(goals)
        .where(and(eq(goals.id, task.goalId), eq(goals.userId, userId)));

      if (linkedGoal) {
        let newTotal: number;
        if (linkedGoal.goalType === 'outcome') {
          newTotal = isCompleted && completionValue > 0 ? completionValue : linkedGoal.currentValue;
        } else {
          const allWithProgress = await db
            .select({ value: tasks.value })
            .from(tasks)
            .where(and(eq(tasks.goalId, task.goalId), or(eq(tasks.completed, true), gt(tasks.value, 0))));
          newTotal = allWithProgress.reduce((sum, t) => sum + (t.value ?? 0), 0);
        }

        await db
          .update(goals)
          .set({ currentValue: newTotal })
          .where(eq(goals.id, linkedGoal.id));

        // Auto-complete project goals when every subtask is done
        if (linkedGoal.goalType === 'project' && linkedGoal.status === 'active' && linkedGoal.targetValue > 0 && newTotal >= linkedGoal.targetValue) {
          await db.update(goals)
            .set({ status: 'completed' })
            .where(eq(goals.id, linkedGoal.id));
          await createAutoLog(userId, `🏆 Project completed: ${linkedGoal.name}`);
        }

        // Auto-complete target goals when target is reached
        if (linkedGoal.goalType === 'target' && linkedGoal.status === 'active') {
          const isDecrease = linkedGoal.targetValue < linkedGoal.startValue;
          const reached = isDecrease ? newTotal <= linkedGoal.targetValue : newTotal >= linkedGoal.targetValue;
          if (reached) {
            await db.update(goals)
              .set({ status: 'completed', currentValue: linkedGoal.targetValue })
              .where(eq(goals.id, linkedGoal.id));

            // Delete remaining uncompleted tasks for this goal
            const remaining = await db.select({ id: tasks.id }).from(tasks)
              .where(and(eq(tasks.goalId, linkedGoal.id), eq(tasks.userId, userId), eq(tasks.completed, false)));
            await deleteTasksByIds(remaining.map(r => r.id));

            await createAutoLog(userId, `🏆 Goal auto-completed: ${linkedGoal.name}`);
          }
        }
      }
    } catch (err) {
      console.error("Failed to update linked goal:", err);
    }
  }

  // Invalidate recalc cache
  invalidateRecalcCache(userId);

  // Recalculate and save daily score
  const taskDate = result.date || date;
  if (taskDate) {
    await saveDailyScore(userId, taskDate);
    if (date && date !== taskDate) {
      await saveDailyScore(userId, date);
    }
  }

  return { task, result };
}
