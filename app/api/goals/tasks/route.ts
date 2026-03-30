import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, tasks } from "@/lib/db";
import { eq, and, isNotNull } from "drizzle-orm";

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();

    const goalTasks = await db
      .select({
        id: tasks.id,
        name: tasks.name,
        goalId: tasks.goalId,
        completionType: tasks.completionType,
        basePoints: tasks.basePoints,
        target: tasks.target,
        unit: tasks.unit,
        date: tasks.date,
        completed: tasks.completed,
        value: tasks.value,
      })
      .from(tasks)
      .where(and(
        eq(tasks.userId, userId),
        isNotNull(tasks.goalId),
        eq(tasks.dismissed, false),
      ));

    return NextResponse.json(goalTasks);
  } catch (error) {
    return errorResponse(error);
  }
}
