import { db, tasks } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getYesterdayString } from "@/lib/format";

// Decide whether a task can still be edited. Tasks dated before "yesterday" are frozen.
// If a refDate is given (typically a client-provided date used to avoid server timezone drift),
// "yesterday" is computed relative to it; otherwise the server's local yesterday is used.
// Empty-string dates (no-date tasks) are always editable.
export function isTaskTooOldToEdit(taskDate: string, refDate?: string | null): boolean {
  if (!taskDate) return false;
  let yesterday: string;
  if (refDate) {
    const d = new Date(refDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    yesterday = d.toISOString().split('T')[0];
  } else {
    yesterday = getYesterdayString();
  }
  return taskDate < yesterday;
}

// Goal-linked or schedule-linked tasks are dismissed (not deleted) so they don't get auto-recreated.
// Standalone adhoc tasks are deleted outright.
export async function dismissOrDeleteTask(taskId: number, userId: string, hasGoalId: boolean | number | null, hasScheduleId: boolean | number | null): Promise<void> {
  if (hasGoalId || hasScheduleId) {
    await db.update(tasks).set({ dismissed: true, completed: false, value: null, pointsEarned: 0 }).where(eq(tasks.id, taskId));
  } else {
    await db.delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
  }
}
