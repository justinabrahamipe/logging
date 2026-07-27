import { NextResponse } from "next/server";
import { db, tasks } from "@/lib/db";
import { eq, and, isNotNull } from "drizzle-orm";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";

export async function GET() {
  try {
  const userId = await getAuthenticatedUserId();

  // Get all goal-linked tasks
  const goalTasks = await db
    .select({ id: tasks.id, goalId: tasks.goalId, date: tasks.date, originalDate: tasks.originalDate, value: tasks.value, completed: tasks.completed })
    .from(tasks)
    .where(and(
      eq(tasks.userId, userId),
      isNotNull(tasks.goalId),
    ));

  // Build goalId -> { date, value, completed }[] map
  // Postponed tasks that were completed: credit the original date with the completion
  // so the habit tracker shows green on the day the task was meant for
  const result: Record<number, { date: string; value: number; completed: boolean }[]> = {};
  for (const t of goalTasks) {
    const goalId = t.goalId!;
    if (!result[goalId]) result[goalId] = [];

    const wasPostponed = t.originalDate && t.originalDate !== t.date;
    const isCompleted = t.completed || (t.value != null && t.value > 0);

    if (wasPostponed && !isCompleted) {
      // Postponed but not yet completed — mark original date as neutral
      result[goalId].push({ date: t.originalDate!, value: -1, completed: false });
      continue;
    }

    if (!isCompleted) continue;

    // For checkbox tasks, value is null when completed — treat as 1
    const value = t.value != null ? t.value : (t.completed ? 1 : 0);

    if (wasPostponed) {
      // Postponed and completed — credit the original date
      result[goalId].push({ date: t.originalDate!, value, completed: t.completed });
    } else {
      result[goalId].push({ date: t.date, value, completed: t.completed });
    }
  }

  return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
