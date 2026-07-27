import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { completeTask } from "@/lib/complete-task";
import { db, tasks } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();

    const body = await request.json();
    const { taskId, date, value, completed } = body;

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    // Verify task belongs to user (try as task instance ID first, then as schedule ID + date)
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

    // Only allow changes for today and yesterday — older tasks are frozen
    // Use client-provided date to derive yesterday (avoids server timezone mismatch)
    const refDate = date || task.date;
    const clientYesterday = new Date(refDate + 'T12:00:00');
    clientYesterday.setDate(clientYesterday.getDate() - 1);
    const yesterdayStr = clientYesterday.toISOString().split('T')[0];
    if (task.date && task.date < yesterdayStr) {
      return NextResponse.json({ error: "Cannot modify tasks older than yesterday" }, { status: 403 });
    }

    const { result } = await completeTask({ userId, taskId, date, completed, value });

    // Return in completion format for backward compat
    return NextResponse.json({
      id: result.id,
      taskId: result.id,
      completed: result.completed,
      value: result.value,
      pointsEarned: result.pointsEarned,
      isHighlighted: result.isHighlighted,
      skipped: result.skipped,
      timerStartedAt: result.timerStartedAt,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
