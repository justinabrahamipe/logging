import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, tasks, activityLog, goals } from "@/lib/db";
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

    // Verify task belongs to user (try as task instance ID first, then as schedule ID + date)
    let [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

    if (!task) {
      // Fall back: taskId might be a schedule ID — find the task instance for that schedule + date
      [task] = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.scheduleId, taskId), eq(tasks.date, date), eq(tasks.userId, userId)));
    }

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const completionValue = value ?? (task.completionType === 'checkbox' ? (completed ? 1 : 0) : 0);
    const targetReached = task.target != null && task.target > 0 && completionValue >= task.target;
    const isCompleted = completed ?? (
      task.completionType === 'checkbox' ? true :
      task.completionType === 'duration' ? targetReached :
      targetReached || completionValue > 0
    );

    const pointsEarned = calculateTaskScore(
      { id: task.id, pillarId: task.pillarId, completionType: task.completionType, target: task.target, basePoints: task.basePoints, flexibilityRule: task.flexibilityRule, limitValue: task.limitValue },
      { taskId: task.id, completed: isCompleted, value: completionValue }
    );

    const previousValue = task.value ?? null;
    const pointsBefore = task.pointsEarned ?? 0;

    // Update the task row directly (completion data lives on the task)
    const [result] = await db
      .update(tasks)
      .set({
        completed: isCompleted,
        value: completionValue,
        pointsEarned,
        completedAt: isCompleted ? new Date() : null,
      })
      .where(eq(tasks.id, taskId))
      .returning();

    // Determine action type
    let action = 'complete';
    if (previousValue !== null) {
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

    // Update linked goal's currentValue by recalculating from all completed tasks
    if (task.goalId) {
      try {
        const [linkedGoal] = await db
          .select()
          .from(goals)
          .where(and(eq(goals.id, task.goalId), eq(goals.userId, userId)));

        if (linkedGoal) {
          let newTotal: number;
          if (linkedGoal.goalType === 'outcome') {
            // For outcome goals (e.g., weight), value is absolute — use latest
            newTotal = isCompleted && completionValue > 0 ? completionValue : linkedGoal.currentValue;
          } else {
            // For target/habitual goals, recalculate from all completed tasks
            const allCompleted = await db
              .select({ value: tasks.value })
              .from(tasks)
              .where(and(eq(tasks.goalId, task.goalId), eq(tasks.completed, true)));
            newTotal = allCompleted.reduce((sum, t) => sum + (t.value ?? 0), 0);
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
