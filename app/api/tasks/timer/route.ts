import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, tasks } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    const { taskId, action } = await request.json();

    if (!taskId || !action) {
      return NextResponse.json({ error: "taskId and action are required" }, { status: 400 });
    }

    const [task] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

    if (!task) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (action === "start") {
      await db
        .update(tasks)
        .set({ timerStartedAt: Date.now() })
        .where(eq(tasks.id, taskId));
    } else if (action === "stop") {
      await db
        .update(tasks)
        .set({ timerStartedAt: null })
        .where(eq(tasks.id, taskId));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
