import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, tasks, taskCompletions, activityLog } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { calculateTaskScore } from "@/lib/scoring";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { taskId, date, value, completed } = body;

  if (!taskId || !date) {
    return NextResponse.json({ error: "taskId and date are required" }, { status: 400 });
  }

  // Verify task belongs to user
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id)));

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const isCompleted = completed ?? (task.completionType === 'checkbox' ? true : (value ?? 0) > 0);
  const completionValue = value ?? (task.completionType === 'checkbox' ? (isCompleted ? 1 : 0) : 0);

  const pointsEarned = calculateTaskScore(
    { id: task.id, pillarId: task.pillarId, completionType: task.completionType, target: task.target, importance: task.importance, basePoints: task.basePoints, flexibilityRule: task.flexibilityRule, limitValue: task.limitValue },
    { taskId: task.id, completed: isCompleted, value: completionValue }
  );

  // Check existing completion
  const [existing] = await db
    .select()
    .from(taskCompletions)
    .where(and(eq(taskCompletions.taskId, taskId), eq(taskCompletions.date, date)));

  const previousValue = existing?.value ?? null;
  const pointsBefore = existing?.pointsEarned ?? 0;

  let result;
  if (existing) {
    [result] = await db
      .update(taskCompletions)
      .set({
        completed: isCompleted,
        value: completionValue,
        pointsEarned,
        completedAt: isCompleted ? new Date() : null,
      })
      .where(eq(taskCompletions.id, existing.id))
      .returning();
  } else {
    [result] = await db.insert(taskCompletions).values({
      taskId,
      userId: session.user.id,
      date,
      completed: isCompleted,
      value: completionValue,
      pointsEarned,
      completedAt: isCompleted ? new Date() : null,
    }).returning();
  }

  // Determine action type
  let action = 'complete';
  if (existing) {
    if (completionValue > (previousValue ?? 0)) action = 'add';
    else if (completionValue < (previousValue ?? 0)) action = 'subtract';
    else action = 'adjust';
  }

  // Determine source
  const source = task.completionType === 'duration' ? 'timer' : 'manual';

  // Insert activity log entry
  await db.insert(activityLog).values({
    userId: session.user.id,
    taskId: task.id,
    pillarId: task.pillarId,
    action,
    previousValue: previousValue,
    newValue: completionValue,
    delta: completionValue - (previousValue ?? 0),
    pointsBefore,
    pointsAfter: pointsEarned,
    pointsDelta: pointsEarned - pointsBefore,
    source,
  });

  return NextResponse.json(result);
}
