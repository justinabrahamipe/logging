import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, tasks } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function PUT(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    const { taskIds } = await request.json();

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json({ error: "taskIds array is required" }, { status: 400 });
    }

    // Update sortOrder for each task
    for (let i = 0; i < taskIds.length; i++) {
      await db
        .update(tasks)
        .set({ sortOrder: i + 1 })
        .where(and(eq(tasks.id, taskIds[i]), eq(tasks.userId, userId)));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
