import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, tasks, taskCompletions, activityLog } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();

    const body = await request.json();
    const { taskId, date } = body;

    if (!taskId || !date) {
      return NextResponse.json({ error: "taskId and date are required" }, { status: 400 });
    }

    // Verify task belongs to user
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId), eq(tasks.isActive, true)));

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Fetch current completion
    const [existing] = await db
      .select()
      .from(taskCompletions)
      .where(and(eq(taskCompletions.taskId, taskId), eq(taskCompletions.date, date)));

    if (!existing || !existing.completed) {
      return NextResponse.json({ error: "No completion to undo" }, { status: 400 });
    }

    // Find the most recent activity log entry for this task+date to reference
    const [lastLog] = await db
      .select()
      .from(activityLog)
      .where(and(eq(activityLog.taskId, taskId), eq(activityLog.userId, userId)))
      .orderBy(desc(activityLog.id))
      .limit(1);

    // Reset completion
    const [result] = await db
      .update(taskCompletions)
      .set({
        completed: false,
        value: 0,
        pointsEarned: 0,
        completedAt: null,
      })
      .where(eq(taskCompletions.id, existing.id))
      .returning();

    // Create reversal activity log entry
    await db.insert(activityLog).values({
      userId,
      taskId: task.id,
      pillarId: task.pillarId,
      action: 'reverse',
      previousValue: existing.value,
      newValue: 0,
      delta: -(existing.value ?? 0),
      pointsBefore: existing.pointsEarned,
      pointsAfter: 0,
      pointsDelta: -existing.pointsEarned,
      source: 'manual',
    });

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
