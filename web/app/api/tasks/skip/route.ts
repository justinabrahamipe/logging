import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, tasks } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { saveDailyScore } from "@/lib/save-daily-score";

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    const { taskId, skipped, date } = await request.json();

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Use client-provided date to derive yesterday (avoids server timezone mismatch)
    const refDate = date || task.date;
    const clientYesterday = new Date(refDate + 'T12:00:00');
    clientYesterday.setDate(clientYesterday.getDate() - 1);
    const yesterdayStr = clientYesterday.toISOString().split('T')[0];
    if (task.date && task.date < yesterdayStr) {
      return NextResponse.json({ error: "Cannot modify tasks older than yesterday" }, { status: 403 });
    }

    const [result] = await db
      .update(tasks)
      .set({ skipped: skipped ?? true })
      .where(eq(tasks.id, taskId))
      .returning();

    // Recalculate daily score
    if (result.date) {
      await saveDailyScore(userId, result.date);
    }

    return NextResponse.json({
      id: result.id,
      taskId: result.id,
      completed: result.completed,
      value: result.value,
      pointsEarned: result.pointsEarned,
      isHighlighted: result.isHighlighted,
      timerStartedAt: result.timerStartedAt,
      skipped: result.skipped,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
