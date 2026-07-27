import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, tasks } from "@/lib/db";
import { eq, and, desc, isNotNull } from "drizzle-orm";
import { errorResponse } from "@/lib/api-utils";

export async function GET() {
  try {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Query completed tasks linked to goals
  const logs = await db
    .select({
      id: tasks.id,
      goalId: tasks.goalId,
      value: tasks.value,
      date: tasks.date,
    })
    .from(tasks)
    .where(and(
      eq(tasks.userId, session.user.id),
      eq(tasks.completed, true),
      isNotNull(tasks.goalId),
    ))
    .orderBy(desc(tasks.date));

  // Group by goalId (mapped as outcomeId for backward compat)
  const grouped: Record<number, { id: number; value: number; loggedAt: string }[]> = {};
  for (const log of logs) {
    const outcomeId = log.goalId!;
    const loggedAt = log.date + "T12:00:00.000Z";
    if (!grouped[outcomeId]) grouped[outcomeId] = [];
    grouped[outcomeId].push({ id: log.id, value: log.value ?? 0, loggedAt });
  }

  return NextResponse.json(grouped);
  } catch (error) {
    return errorResponse(error);
  }
}
