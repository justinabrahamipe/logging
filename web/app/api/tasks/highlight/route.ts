import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, tasks } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { saveDailyScore } from "@/lib/save-daily-score";

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();

    const body = await request.json();
    const { taskId, date, isHighlighted } = body;

    if (!taskId || !date) {
      return NextResponse.json({ error: "taskId and date are required" }, { status: 400 });
    }

    // If highlighting (not un-highlighting), check max 3 per day
    if (isHighlighted) {
      const dayTasks = await db
        .select()
        .from(tasks)
        .where(and(
          eq(tasks.userId, userId),
          eq(tasks.date, date),
          eq(tasks.isHighlighted, true)
        ));

      const currentHighlighted = dayTasks.filter(t => t.id !== taskId);
      if (currentHighlighted.length >= 3) {
        return NextResponse.json({ error: "Maximum 3 highlighted tasks per day" }, { status: 400 });
      }
    }

    // Find the task row (try task ID first, then schedule ID + date)
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

    // Use client-provided date to derive yesterday (avoids server timezone mismatch)
    const clientYesterday = new Date(date + 'T12:00:00');
    clientYesterday.setDate(clientYesterday.getDate() - 1);
    const yesterdayStr = clientYesterday.toISOString().split('T')[0];
    if (task.date && task.date < yesterdayStr) {
      return NextResponse.json({ error: "Cannot modify tasks older than yesterday" }, { status: 403 });
    }

    const [updated] = await db
      .update(tasks)
      .set({ isHighlighted: isHighlighted ?? !task.isHighlighted })
      .where(eq(tasks.id, taskId))
      .returning();

    await saveDailyScore(userId, date);

    // Return in completion format for backward compat
    return NextResponse.json({
      id: updated.id,
      taskId: updated.id,
      completed: updated.completed,
      value: updated.value,
      pointsEarned: updated.pointsEarned,
      isHighlighted: updated.isHighlighted,
      skipped: updated.skipped,
      timerStartedAt: updated.timerStartedAt,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
