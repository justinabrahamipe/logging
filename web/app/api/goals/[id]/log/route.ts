import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse, parseId } from "@/lib/api-utils";
import { db, goals, activityLog, tasks, taskSchedules } from "@/lib/db";
import { saveDailyScore } from "@/lib/save-daily-score";
import { eq, and, desc } from "drizzle-orm";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();

    const { id } = await params;
    const outcomeId = parseId(id);

    // Verify ownership
    const [outcome] = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, outcomeId), eq(goals.userId, userId)));

    if (!outcome) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Query completed tasks linked to this goal
    const logs = await db
      .select({
        id: tasks.id,
        value: tasks.value,
        loggedAt: tasks.date,
        outcomeId: tasks.goalId,
      })
      .from(tasks)
      .where(and(eq(tasks.goalId, outcomeId), eq(tasks.completed, true)))
      .orderBy(desc(tasks.date));

    // Map to expected format
    const mapped = logs.map(l => ({
      id: l.id,
      outcomeId: l.outcomeId,
      value: l.value ?? 0,
      loggedAt: l.loggedAt + "T12:00:00.000Z",
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();

    const { id } = await params;
    const outcomeId = parseId(id);
    const body = await request.json();

    if (body.value == null) {
      return NextResponse.json({ error: "Value is required" }, { status: 400 });
    }

    // Verify ownership
    const [outcome] = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, outcomeId), eq(goals.userId, userId)));

    if (!outcome) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const previousValue = outcome.currentValue;
    const today = body.loggedAt || new Date().toISOString().split("T")[0];

    // For target goals, value is a delta; for outcomes, value is absolute
    const isTarget = outcome.goalType === 'target' || outcome.goalType === 'habitual';
    const newCurrentValue = isTarget ? previousValue + body.value : body.value;

    // Find existing task instance for this goal on this date
    let [existingTask] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.goalId, outcomeId), eq(tasks.userId, userId), eq(tasks.date, today)));

    if (!existingTask) {
      // Create an adhoc task schedule + instance for this goal log
      const [schedule] = await db.insert(taskSchedules).values({
        userId,
        name: `Log ${outcome.name}`,
        pillarId: outcome.pillarId,
        goalId: outcomeId,
        completionType: 'numeric',
        frequency: 'adhoc',
        startDate: today,
        basePoints: 0,
      }).returning();

      [existingTask] = await db.insert(tasks).values({
        scheduleId: schedule.id,
        userId,
        name: `Log ${outcome.name}`,
        pillarId: outcome.pillarId,
        goalId: outcomeId,
        completionType: 'numeric',
        basePoints: 0,
        date: today,
      }).returning();
    }

    // Update the task row with completion data
    await db
      .update(tasks)
      .set({
        value: body.value,
        completed: true,
        completedAt: new Date(),
      })
      .where(eq(tasks.id, existingTask.id));

    // Update currentValue on the goal
    await db
      .update(goals)
      .set({ currentValue: newCurrentValue })
      .where(eq(goals.id, outcomeId));

    // Auto-complete target goals when target is reached
    if (outcome.goalType === 'target' && outcome.status === 'active') {
      const isDecrease2 = outcome.targetValue < outcome.startValue;
      const reached = isDecrease2 ? newCurrentValue <= outcome.targetValue : newCurrentValue >= outcome.targetValue;
      if (reached) {
        await db.update(goals).set({ status: 'completed', currentValue: outcome.targetValue }).where(eq(goals.id, outcomeId));
        const remaining = await db.select({ id: tasks.id }).from(tasks)
          .where(and(eq(tasks.goalId, outcomeId), eq(tasks.userId, userId), eq(tasks.completed, false)));
        for (const r of remaining) {
          await db.delete(tasks).where(eq(tasks.id, r.id));
        }
      }
    }

    // Create activity log entry
    try {
      await db.insert(activityLog).values({
        userId,
        timestamp: new Date(),
        pillarId: outcome.pillarId,
        taskId: existingTask.id,
        action: 'outcome_log',
        previousValue,
        newValue: newCurrentValue,
        delta: isTarget ? body.value : body.value - previousValue,
        source: body.source || 'manual',
      });
    } catch (err) {
      console.error("Failed to create activity log for outcome:", err);
    }

    // Recalculate daily score for the logged date
    await saveDailyScore(userId, today);

    // Return in same format as old outcomeLogs
    return NextResponse.json({
      id: existingTask.id,
      outcomeId,
      value: body.value,
      loggedAt: new Date(today + "T12:00:00"),
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();

    const { id } = await params;
    const outcomeId = parseId(id);
    const body = await request.json();

    if (!body.logId || body.value == null) {
      return NextResponse.json({ error: "logId and value are required" }, { status: 400 });
    }

    // Verify ownership
    const [outcome] = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, outcomeId), eq(goals.userId, userId)));

    if (!outcome) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Verify the task exists and belongs to this goal
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, body.logId), eq(tasks.goalId, outcomeId)));

    if (!task) {
      return NextResponse.json({ error: "Log not found" }, { status: 404 });
    }

    // Update the task's value
    const [updated] = await db
      .update(tasks)
      .set({ value: body.value })
      .where(eq(tasks.id, body.logId))
      .returning();

    // Update the goal's currentValue
    const isTargetGoal = outcome.goalType === 'target' || outcome.goalType === 'habitual';
    if (isTargetGoal) {
      // For target/habitual goals, recalculate as sum of all completed task values
      const allTasks = await db
        .select({ value: tasks.value })
        .from(tasks)
        .where(and(eq(tasks.goalId, outcomeId), eq(tasks.completed, true)));
      const total = allTasks.reduce((sum, t) => sum + (t.value ?? 0), 0);
      await db
        .update(goals)
        .set({ currentValue: total })
        .where(eq(goals.id, outcomeId));
    } else {
      // For outcome goals, use the latest task value
      const [latestTask] = await db
        .select({ value: tasks.value, date: tasks.date })
        .from(tasks)
        .where(and(eq(tasks.goalId, outcomeId), eq(tasks.completed, true)))
        .orderBy(desc(tasks.date))
        .limit(1);
      if (latestTask) {
        await db
          .update(goals)
          .set({ currentValue: latestTask.value ?? 0 })
          .where(eq(goals.id, outcomeId));
      }
    }

    // Recalculate daily score for the affected date
    await saveDailyScore(userId, updated.date);

    // Return in same format
    return NextResponse.json({
      id: updated.id,
      outcomeId,
      value: body.value,
      loggedAt: updated.date + "T12:00:00.000Z",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
