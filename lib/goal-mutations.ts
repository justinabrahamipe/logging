import { db, tasks } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getTodayString } from "@/lib/format";
import { deleteTasksByIds } from "@/lib/db-utils";
import { generateGoalTasks } from "@/lib/ensure-upcoming-tasks";

export async function deleteFutureUncompletedTasks(goalId: number, userId: string): Promise<void> {
  const todayStr = getTodayString();
  const futureTasks = await db
    .select({ id: tasks.id, date: tasks.date })
    .from(tasks)
    .where(and(
      eq(tasks.goalId, goalId),
      eq(tasks.userId, userId),
      eq(tasks.completed, false),
    ));
  const futureIds = futureTasks.filter(t => t.date > todayStr).map(t => t.id);
  await deleteTasksByIds(futureIds);
}

export async function deleteTasksBeyondDate(goalId: number, userId: string, targetDate: string): Promise<void> {
  const beyondTasks = await db
    .select({ id: tasks.id, date: tasks.date })
    .from(tasks)
    .where(and(
      eq(tasks.goalId, goalId),
      eq(tasks.userId, userId),
      eq(tasks.completed, false),
    ));
  const beyondIds = beyondTasks.filter(t => t.date > targetDate).map(t => t.id);
  await deleteTasksByIds(beyondIds);
}

export async function deleteTasksOnRemovedDays(goalId: number, userId: string, oldScheduleDays: number[], newScheduleDays: number[]): Promise<void> {
  const removedDays = oldScheduleDays.filter(d => !newScheduleDays.includes(d));
  if (removedDays.length === 0) return;

  const todayStr = getTodayString();
  const futureTasks = await db
    .select({ id: tasks.id, date: tasks.date })
    .from(tasks)
    .where(and(
      eq(tasks.goalId, goalId),
      eq(tasks.userId, userId),
      eq(tasks.completed, false),
    ));

  const idsToDelete: number[] = [];
  for (const t of futureTasks) {
    if (t.date >= todayStr) {
      const dow = new Date(t.date + 'T12:00:00').getDay();
      if (removedDays.includes(dow)) {
        idsToDelete.push(t.id);
      }
    }
  }
  await deleteTasksByIds(idsToDelete);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function regenerateGoalTasksIfNeeded(goalId: number, userId: string, existing: any, body: any, updated: any): Promise<void> {
  const needsRegenerate = (
    (body.targetDate !== undefined && body.targetDate > (existing.targetDate || '')) ||
    (body.startDate !== undefined) ||
    (body.scheduleDays !== undefined) ||
    (body.autoCreateTasks === true && !existing.autoCreateTasks)
  );
  const autoCreate = updated?.autoCreateTasks ?? (body.autoCreateTasks !== undefined ? body.autoCreateTasks : existing.autoCreateTasks);
  const status = updated?.status ?? (body.status || existing.status);
  if (needsRegenerate && autoCreate && status === 'active') {
    await generateGoalTasks(userId, goalId);
  }
}
