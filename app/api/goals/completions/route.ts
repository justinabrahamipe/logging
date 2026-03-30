import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, tasks } from "@/lib/db";
import { eq, and, isNotNull } from "drizzle-orm";
import { errorResponse } from "@/lib/api-utils";

export async function GET() {
  try {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all goal-linked tasks
  const goalTasks = await db
    .select({ id: tasks.id, goalId: tasks.goalId, date: tasks.date, originalDate: tasks.originalDate, value: tasks.value, completed: tasks.completed })
    .from(tasks)
    .where(and(
      eq(tasks.userId, session.user.id),
      isNotNull(tasks.goalId),
    ));

  // Build goalId -> { date, value, completed }[] map
  // Postponed tasks (originalDate != date) get value=-1 on their original date
  // so the habit tracker can show them as neutral instead of missed
  const result: Record<number, { date: string; value: number; completed: boolean }[]> = {};
  for (const t of goalTasks) {
    const goalId = t.goalId!;
    if (!result[goalId]) result[goalId] = [];

    // Mark postponed original date as neutral (value -1 sentinel)
    if (t.originalDate && t.originalDate !== t.date) {
      result[goalId].push({ date: t.originalDate, value: -1, completed: false });
    }

    // Only include tasks with progress or completion
    if (!t.completed && !(t.value != null && t.value > 0)) continue;
    // For checkbox tasks, value is null when completed — treat as 1
    const value = t.value != null ? t.value : (t.completed ? 1 : 0);
    result[goalId].push({ date: t.date, value, completed: t.completed });
  }

  return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
