import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, tasks, taskCompletions } from "@/lib/db";
import { eq, and, desc, isNotNull } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Query TaskCompletions joined with Tasks where task has a goalId
  const logs = await db
    .select({
      id: taskCompletions.id,
      goalId: tasks.goalId,
      value: taskCompletions.value,
      date: taskCompletions.date,
    })
    .from(taskCompletions)
    .innerJoin(tasks, eq(taskCompletions.taskId, tasks.id))
    .where(and(
      eq(taskCompletions.userId, session.user.id),
      eq(taskCompletions.completed, true),
      isNotNull(tasks.goalId),
    ))
    .orderBy(desc(taskCompletions.date));

  // Group by goalId (mapped as outcomeId for backward compat)
  const grouped: Record<number, { id: number; value: number; loggedAt: string }[]> = {};
  for (const log of logs) {
    const outcomeId = log.goalId!;
    const loggedAt = log.date + "T12:00:00.000Z";
    if (!grouped[outcomeId]) grouped[outcomeId] = [];
    grouped[outcomeId].push({ id: log.id, value: log.value ?? 0, loggedAt });
  }

  return NextResponse.json(grouped);
}
