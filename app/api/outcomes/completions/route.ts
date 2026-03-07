import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, tasks, taskCompletions } from "@/lib/db";
import { eq, and, isNotNull } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all tasks linked to outcomes
  const linkedTasks = await db
    .select({ id: tasks.id, outcomeId: tasks.outcomeId })
    .from(tasks)
    .where(and(eq(tasks.userId, session.user.id), isNotNull(tasks.outcomeId)));

  if (linkedTasks.length === 0) return NextResponse.json({});

  // Get all completions for these tasks
  const taskIds = linkedTasks.map(t => t.id);
  const completions = await db
    .select({ taskId: taskCompletions.taskId, date: taskCompletions.date, completed: taskCompletions.completed })
    .from(taskCompletions)
    .where(and(eq(taskCompletions.userId, session.user.id), eq(taskCompletions.completed, true)));

  // Build outcomeId -> dates map
  const taskToOutcome = new Map(linkedTasks.map(t => [t.id, t.outcomeId]));
  const result: Record<number, string[]> = {};

  for (const c of completions) {
    if (!taskIds.includes(c.taskId)) continue;
    const outcomeId = taskToOutcome.get(c.taskId);
    if (!outcomeId) continue;
    if (!result[outcomeId]) result[outcomeId] = [];
    result[outcomeId].push(c.date);
  }

  return NextResponse.json(result);
}
