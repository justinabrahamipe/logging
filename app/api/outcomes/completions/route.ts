import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, tasks, taskCompletions } from "@/lib/db";
import { eq, and, isNotNull, inArray } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all tasks linked to outcomes
  const linkedTasks = await db
    .select({ id: tasks.id, goalId: tasks.goalId })
    .from(tasks)
    .where(and(eq(tasks.userId, session.user.id), isNotNull(tasks.goalId)));

  if (linkedTasks.length === 0) return NextResponse.json({});

  // Get completions only for linked task IDs
  const taskIds = linkedTasks.map(t => t.id);
  const completions = taskIds.length > 0
    ? await db
        .select({ taskId: taskCompletions.taskId, date: taskCompletions.date })
        .from(taskCompletions)
        .where(and(
          eq(taskCompletions.userId, session.user.id),
          eq(taskCompletions.completed, true),
          inArray(taskCompletions.taskId, taskIds),
        ))
    : [];

  // Build goalId -> dates map
  const taskToOutcome = new Map(linkedTasks.map(t => [t.id, t.goalId]));
  const result: Record<number, string[]> = {};

  for (const c of completions) {
    const goalId = taskToOutcome.get(c.taskId);
    if (!goalId) continue;
    if (!result[goalId]) result[goalId] = [];
    result[goalId].push(c.date);
  }

  return NextResponse.json(result);
}
