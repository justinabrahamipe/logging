import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, tasks, taskCompletions, activityLog, goals } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { calculateTaskScore } from "@/lib/scoring";
import { saveDailyScore } from "@/lib/save-daily-score";

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();

    const body = await request.json();
    const { taskId, date, value, completed } = body;

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

    const completionValue = value ?? (task.completionType === 'checkbox' ? (completed ? 1 : 0) : 0);
    const targetReached = task.target != null && task.target > 0 && completionValue >= task.target;
    const isCompleted = completed ?? (task.completionType === 'checkbox' ? true : targetReached || completionValue > 0);

    const pointsEarned = calculateTaskScore(
      { id: task.id, pillarId: task.pillarId, completionType: task.completionType, target: task.target, basePoints: task.basePoints, flexibilityRule: task.flexibilityRule, limitValue: task.limitValue },
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
        userId,
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
      userId,
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

    // Update linked goal's currentValue when completing a task
    if (task.goalId && isCompleted && completionValue > 0) {
      try {
        const [linkedGoal] = await db
          .select()
          .from(goals)
          .where(and(eq(goals.id, task.goalId), eq(goals.userId, userId)));

        if (linkedGoal) {
          let newTotal: number;
          if (linkedGoal.goalType === 'outcome') {
            // For outcome goals (e.g., weight), value is absolute
            newTotal = completionValue;
          } else {
            // For target/habitual/effort goals, value is additive delta
            const delta = completionValue - (previousValue ?? 0);
            newTotal = linkedGoal.currentValue + delta;
          }

          await db
            .update(goals)
            .set({ currentValue: newTotal })
            .where(eq(goals.id, linkedGoal.id));
        }
      } catch (err) {
        console.error("Failed to update linked goal:", err);
      }
    }

    // Recalculate and save daily score
    await saveDailyScore(userId, date);

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
