import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, tasks } from "@/lib/db";
import { eq, and, isNotNull } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all completed tasks linked to goals
  const completedTasks = await db
    .select({ id: tasks.id, goalId: tasks.goalId, date: tasks.date })
    .from(tasks)
    .where(and(
      eq(tasks.userId, session.user.id),
      eq(tasks.isActive, true),
      eq(tasks.completed, true),
      isNotNull(tasks.goalId),
    ));

  // Build goalId -> dates map
  const result: Record<number, string[]> = {};
  for (const t of completedTasks) {
    const goalId = t.goalId!;
    if (!result[goalId]) result[goalId] = [];
    result[goalId].push(t.date);
  }

  return NextResponse.json(result);
}
