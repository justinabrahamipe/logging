import { db, tasks, goals } from "@/lib/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { getTodayString } from "@/lib/format";

function yesterdayOf(todayStr: string): string {
  const d = new Date(todayStr + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

export type FrozenContext = {
  goalTypeById: Map<number, string>;
  latestHabitualDateBySchedule: Map<number, string>;
  todayStr: string;
};

type TaskLike = { date: string; goalId: number | null; scheduleId: number | null };

// Fetch everything needed to decide frozen state for a batch of tasks in a
// constant number of queries: one goal-type lookup, one grouped max-date query
// (only for schedules backing habitual goals).
export async function buildFrozenContext(userId: string, taskRows: TaskLike[], todayStr: string): Promise<FrozenContext> {
  const goalIds = [...new Set(taskRows.map(t => t.goalId).filter((id): id is number => id != null))];
  const goalTypeById = new Map<number, string>();
  if (goalIds.length > 0) {
    const rows = await db.select({ id: goals.id, goalType: goals.goalType }).from(goals).where(inArray(goals.id, goalIds));
    for (const r of rows) goalTypeById.set(r.id, r.goalType);
  }

  const habitualScheduleIds = [...new Set(
    taskRows
      .filter(t => t.scheduleId != null && t.goalId != null && goalTypeById.get(t.goalId) === 'habitual')
      .map(t => t.scheduleId as number)
  )];
  const latestHabitualDateBySchedule = new Map<number, string>();
  if (habitualScheduleIds.length > 0) {
    const rows = await db
      .select({ scheduleId: tasks.scheduleId, date: sql<string>`max(${tasks.date})` })
      .from(tasks)
      .where(and(
        eq(tasks.userId, userId),
        inArray(tasks.scheduleId, habitualScheduleIds),
        eq(tasks.completed, false),
        eq(tasks.skipped, false),
        eq(tasks.dismissed, false),
        sql`${tasks.date} != '' AND ${tasks.date} < ${todayStr}`,
      ))
      .groupBy(tasks.scheduleId);
    for (const r of rows) if (r.scheduleId != null) latestHabitualDateBySchedule.set(r.scheduleId, r.date);
  }

  return { goalTypeById, latestHabitualDateBySchedule, todayStr };
}

// Whether a task instance can still be completed or edited.
// - No-date tasks and tasks not linked to a goal (adhoc, plain repeating tasks) are
//   never frozen — they sit in Overdue until done, however old.
// - Project-goal tasks are never frozen for the same reason.
// - Outcome/target-goal tasks freeze once older than yesterday (fixed today+yesterday window).
// - Habitual-goal tasks freeze unless they are the single most recent unfinished
//   instance of their schedule — only the latest missed day stays actionable,
//   matching how they're curated into Overdue (see app/api/tasks/route.ts).
export function computeTaskFrozen(task: TaskLike, ctx: FrozenContext): boolean {
  if (!task.date || !task.goalId) return false;
  const goalType = ctx.goalTypeById.get(task.goalId);
  if (!goalType || goalType === 'project') return false;

  if (goalType === 'habitual') {
    if (task.date >= ctx.todayStr) return false;
    if (!task.scheduleId) return task.date < yesterdayOf(ctx.todayStr);
    const latest = ctx.latestHabitualDateBySchedule.get(task.scheduleId);
    return !!latest && task.date < latest;
  }

  // outcome | target
  return task.date < yesterdayOf(ctx.todayStr);
}

// Single-task convenience wrapper for mutation routes (complete/skip/highlight/edit).
// If a refDate is given (typically a client-provided date used to avoid server timezone
// drift), "today" is taken relative to it; otherwise the server's local today is used.
export async function isTaskFrozen(userId: string, task: TaskLike, refDate?: string | null): Promise<boolean> {
  const todayStr = refDate || getTodayString();
  const ctx = await buildFrozenContext(userId, [task], todayStr);
  return computeTaskFrozen(task, ctx);
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
