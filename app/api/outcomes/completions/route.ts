import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, tasks } from "@/lib/db";
import { eq, and, isNotNull, or, gt } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all goal-linked tasks with value > 0 OR completed = true
  const goalTasks = await db
    .select({ id: tasks.id, goalId: tasks.goalId, date: tasks.date, value: tasks.value, completed: tasks.completed })
    .from(tasks)
    .where(and(
      eq(tasks.userId, session.user.id),
      isNotNull(tasks.goalId),
      or(
        eq(tasks.completed, true),
        gt(tasks.value, 0),
      ),
    ));

  // Build goalId -> { date, value }[] map
  const result: Record<number, { date: string; value: number }[]> = {};
  for (const t of goalTasks) {
    const goalId = t.goalId!;
    if (!result[goalId]) result[goalId] = [];
    // For checkbox tasks, value is null when completed — treat as 1
    const value = t.value != null ? t.value : (t.completed ? 1 : 0);
    result[goalId].push({ date: t.date, value });
  }

  return NextResponse.json(result);
}
