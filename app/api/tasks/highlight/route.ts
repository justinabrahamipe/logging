import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, taskCompletions } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { saveDailyScore } from "@/lib/save-daily-score";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { taskId, date, isHighlighted } = body;

  if (!taskId || !date) {
    return NextResponse.json({ error: "taskId and date are required" }, { status: 400 });
  }

  // If highlighting (not un-highlighting), check max 3 per day
  if (isHighlighted) {
    const dayCompletions = await db
      .select()
      .from(taskCompletions)
      .where(and(
        eq(taskCompletions.userId, session.user.id),
        eq(taskCompletions.date, date),
        eq(taskCompletions.isHighlighted, true)
      ));

    const currentHighlighted = dayCompletions.filter(c => c.taskId !== taskId);
    if (currentHighlighted.length >= 3) {
      return NextResponse.json({ error: "Maximum 3 highlighted tasks per day" }, { status: 400 });
    }
  }

  // Check if completion exists
  const [existing] = await db
    .select()
    .from(taskCompletions)
    .where(and(eq(taskCompletions.taskId, taskId), eq(taskCompletions.date, date)));

  if (existing) {
    const [updated] = await db
      .update(taskCompletions)
      .set({ isHighlighted: isHighlighted ?? !existing.isHighlighted })
      .where(eq(taskCompletions.id, existing.id))
      .returning();

    await saveDailyScore(session.user.id, date);
    return NextResponse.json(updated);
  } else {
    // Create a completion record just for the highlight flag
    const [created] = await db.insert(taskCompletions).values({
      taskId,
      userId: session.user.id,
      date,
      completed: false,
      value: null,
      pointsEarned: 0,
      isHighlighted: true,
    }).returning();

    await saveDailyScore(session.user.id, date);
    return NextResponse.json(created);
  }
}
