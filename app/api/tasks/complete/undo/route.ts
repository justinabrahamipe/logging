import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, tasks, activityLog } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();

    const body = await request.json();
    const { taskId, date } = body;

    if (!taskId || !date) {
      return NextResponse.json({ error: "taskId and date are required" }, { status: 400 });
    }

    // Verify task belongs to user (try task ID first, then schedule ID + date)
    let [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

    if (!task) {
      [task] = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.scheduleId, taskId), eq(tasks.date, date), eq(tasks.userId, userId)));
    }

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (!task.completed) {
      return NextResponse.json({ error: "No completion to undo" }, { status: 400 });
    }

    // Reset completion on the task row directly
    const [result] = await db
      .update(tasks)
      .set({
        completed: false,
        value: 0,
        pointsEarned: 0,
        completedAt: null,
      })
      .where(eq(tasks.id, taskId))
      .returning();

    // Create reversal activity log entry
    await db.insert(activityLog).values({
      userId,
      taskId: task.id,
      pillarId: task.pillarId,
      action: 'reverse',
      previousValue: task.value,
      newValue: 0,
      delta: -(task.value ?? 0),
      pointsBefore: task.pointsEarned,
      pointsAfter: 0,
      pointsDelta: -task.pointsEarned,
      source: 'manual',
    });

    // Return in completion format for backward compat
    return NextResponse.json({
      id: result.id,
      taskId: result.id,
      completed: result.completed,
      value: result.value,
      pointsEarned: result.pointsEarned,
      isHighlighted: result.isHighlighted,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
