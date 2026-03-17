import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, goals, activityLog, tasks, taskCompletions } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();

    const { id } = await params;
    const outcomeId = parseInt(id);

    // Verify ownership
    const [outcome] = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, outcomeId), eq(goals.userId, userId)));

    if (!outcome) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Query TaskCompletions joined with Tasks where task.goalId = outcomeId
    const logs = await db
      .select({
        id: taskCompletions.id,
        value: taskCompletions.value,
        loggedAt: taskCompletions.date,
        outcomeId: tasks.goalId,
      })
      .from(taskCompletions)
      .innerJoin(tasks, eq(taskCompletions.taskId, tasks.id))
      .where(and(eq(tasks.goalId, outcomeId), eq(tasks.isActive, true), eq(taskCompletions.completed, true)))
      .orderBy(desc(taskCompletions.date));

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
    const outcomeId = parseInt(id);
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

    // Find or create a task for this goal on this date
    let [existingTask] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.goalId, outcomeId), eq(tasks.userId, userId), eq(tasks.isActive, true), eq(tasks.startDate, today)));

    if (!existingTask) {
      // Look for any active task linked to this goal
      [existingTask] = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.goalId, outcomeId), eq(tasks.userId, userId), eq(tasks.isActive, true)));
    }

    if (!existingTask) {
      // Create an adhoc task for this goal
      [existingTask] = await db.insert(tasks).values({
        userId,
        name: `Log ${outcome.name}`,
        pillarId: outcome.pillarId,
        goalId: outcomeId,
        completionType: 'numeric',
        frequency: 'adhoc',
        startDate: today,
        basePoints: 0,
        isActive: true,
      }).returning();
    }

    // Create or update TaskCompletion for that task on this date
    const [existingCompletion] = await db
      .select()
      .from(taskCompletions)
      .where(and(eq(taskCompletions.taskId, existingTask.id), eq(taskCompletions.date, today)));

    let completion;
    if (existingCompletion) {
      [completion] = await db
        .update(taskCompletions)
        .set({
          value: body.value,
          completed: true,
          completedAt: new Date(),
        })
        .where(eq(taskCompletions.id, existingCompletion.id))
        .returning();
    } else {
      [completion] = await db.insert(taskCompletions).values({
        taskId: existingTask.id,
        userId,
        date: today,
        completed: true,
        value: body.value,
        pointsEarned: 0,
        completedAt: new Date(),
      }).returning();
    }

    // Update currentValue on the goal
    await db
      .update(goals)
      .set({ currentValue: newCurrentValue })
      .where(eq(goals.id, outcomeId));

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

    // Return in same format as old outcomeLogs
    return NextResponse.json({
      id: completion.id,
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
    const outcomeId = parseInt(id);
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

    // Verify the completion exists and belongs to a task linked to this goal
    const completionWithTask = await db
      .select({
        completion: taskCompletions,
        taskGoalId: tasks.goalId,
      })
      .from(taskCompletions)
      .innerJoin(tasks, eq(taskCompletions.taskId, tasks.id))
      .where(and(eq(taskCompletions.id, body.logId), eq(tasks.goalId, outcomeId)));

    if (completionWithTask.length === 0) {
      return NextResponse.json({ error: "Log not found" }, { status: 404 });
    }

    const existingCompletion = completionWithTask[0].completion;
    const oldValue = existingCompletion.value ?? 0;

    // Update the TaskCompletion
    const [updated] = await db
      .update(taskCompletions)
      .set({ value: body.value })
      .where(eq(taskCompletions.id, body.logId))
      .returning();

    // Update the goal's currentValue
    const isTargetGoal = outcome.goalType === 'target' || outcome.goalType === 'habitual';
    if (isTargetGoal) {
      // For target/habitual goals, recalculate as sum of all completion values
      const allCompletions = await db
        .select({ value: taskCompletions.value })
        .from(taskCompletions)
        .innerJoin(tasks, eq(taskCompletions.taskId, tasks.id))
        .where(and(eq(tasks.goalId, outcomeId), eq(tasks.isActive, true), eq(taskCompletions.completed, true)));
      const total = allCompletions.reduce((sum, c) => sum + (c.value ?? 0), 0);
      await db
        .update(goals)
        .set({ currentValue: total })
        .where(eq(goals.id, outcomeId));
    } else {
      // For outcome goals, use the latest completion value
      const [latestCompletion] = await db
        .select({ value: taskCompletions.value, date: taskCompletions.date })
        .from(taskCompletions)
        .innerJoin(tasks, eq(taskCompletions.taskId, tasks.id))
        .where(and(eq(tasks.goalId, outcomeId), eq(tasks.isActive, true), eq(taskCompletions.completed, true)))
        .orderBy(desc(taskCompletions.date))
        .limit(1);
      if (latestCompletion) {
        await db
          .update(goals)
          .set({ currentValue: latestCompletion.value ?? 0 })
          .where(eq(goals.id, outcomeId));
      }
    }

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
