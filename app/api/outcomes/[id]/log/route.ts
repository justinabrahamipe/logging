import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, outcomeLogs, outcomes, activityLog } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const outcomeId = parseInt(id);

  // Verify ownership
  const [outcome] = await db
    .select()
    .from(outcomes)
    .where(and(eq(outcomes.id, outcomeId), eq(outcomes.userId, session.user.id)));

  if (!outcome) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const logs = await db
    .select()
    .from(outcomeLogs)
    .where(eq(outcomeLogs.outcomeId, outcomeId))
    .orderBy(desc(outcomeLogs.loggedAt));

  return NextResponse.json(logs);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const outcomeId = parseInt(id);
  const body = await request.json();

  if (body.value == null) {
    return NextResponse.json({ error: "Value is required" }, { status: 400 });
  }

  // Verify ownership
  const [outcome] = await db
    .select()
    .from(outcomes)
    .where(and(eq(outcomes.id, outcomeId), eq(outcomes.userId, session.user.id)));

  if (!outcome) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const previousValue = outcome.currentValue;

  // For target goals, value is a delta; for outcomes, value is absolute
  const isTarget = outcome.goalType === 'target' || outcome.goalType === 'habitual';
  const newCurrentValue = isTarget ? previousValue + body.value : body.value;

  // Create log entry
  const logValues: Record<string, unknown> = {
    outcomeId,
    userId: session.user.id,
    value: body.value,
    source: body.source || 'manual',
    note: body.note || null,
  };
  if (body.loggedAt) {
    logValues.loggedAt = new Date(body.loggedAt + "T12:00:00");
  }
  const [log] = await db.insert(outcomeLogs).values(logValues as typeof outcomeLogs.$inferInsert).returning();

  // Update currentValue on the outcome
  await db
    .update(outcomes)
    .set({ currentValue: newCurrentValue })
    .where(eq(outcomes.id, outcomeId));

  // Create activity log entry
  try {
    await db.insert(activityLog).values({
      userId: session.user.id,
      timestamp: log.loggedAt,
      pillarId: outcome.pillarId,
      action: 'outcome_log',
      previousValue,
      newValue: newCurrentValue,
      delta: isTarget ? body.value : body.value - previousValue,
      source: body.source || 'manual',
      note: isTarget
        ? `${outcome.name}: +${body.value} ${outcome.unit} (total: ${newCurrentValue})${body.note ? ' - ' + body.note : ''}`
        : `${outcome.name}: ${body.value} ${outcome.unit}${body.note ? ' - ' + body.note : ''}`,
      outcomeLogId: log.id,
    });
  } catch (err) {
    console.error("Failed to create activity log for outcome:", err);
  }

  return NextResponse.json(log, { status: 201 });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const outcomeId = parseInt(id);
  const body = await request.json();

  if (!body.logId || body.value == null) {
    return NextResponse.json({ error: "logId and value are required" }, { status: 400 });
  }

  // Verify ownership
  const [outcome] = await db
    .select()
    .from(outcomes)
    .where(and(eq(outcomes.id, outcomeId), eq(outcomes.userId, session.user.id)));

  if (!outcome) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Verify the log belongs to this outcome
  const [existingLog] = await db
    .select()
    .from(outcomeLogs)
    .where(and(eq(outcomeLogs.id, body.logId), eq(outcomeLogs.outcomeId, outcomeId)));

  if (!existingLog) {
    return NextResponse.json({ error: "Log not found" }, { status: 404 });
  }

  const oldValue = existingLog.value;

  // Update the log entry
  const updates: Record<string, unknown> = { value: body.value };
  if (body.note !== undefined) updates.note = body.note;
  if (body.loggedAt) updates.loggedAt = new Date(body.loggedAt + "T12:00:00");

  const [updated] = await db
    .update(outcomeLogs)
    .set(updates)
    .where(eq(outcomeLogs.id, body.logId))
    .returning();

  // Update the outcome's currentValue
  const isTargetGoal = outcome.goalType === 'target' || outcome.goalType === 'habitual';
  if (isTargetGoal) {
    // For target/habitual goals, recalculate as sum of all deltas
    const allLogs = await db
      .select({ value: outcomeLogs.value })
      .from(outcomeLogs)
      .where(eq(outcomeLogs.outcomeId, outcomeId));
    const total = allLogs.reduce((sum, l) => sum + l.value, 0);
    await db
      .update(outcomes)
      .set({ currentValue: total })
      .where(eq(outcomes.id, outcomeId));
  } else {
    const [latestLog] = await db
      .select()
      .from(outcomeLogs)
      .where(eq(outcomeLogs.outcomeId, outcomeId))
      .orderBy(desc(outcomeLogs.loggedAt))
      .limit(1);
    if (latestLog) {
      await db
        .update(outcomes)
        .set({ currentValue: latestLog.value })
        .where(eq(outcomes.id, outcomeId));
    }
  }

  // Update the linked activity log entry if it exists
  const [existingActivity] = await db
    .select()
    .from(activityLog)
    .where(eq(activityLog.outcomeLogId, body.logId));

  if (existingActivity) {
    await db
      .update(activityLog)
      .set({
        previousValue: oldValue,
        newValue: body.value,
        delta: body.value - oldValue,
        note: `${outcome.name}: ${body.value} ${outcome.unit}${body.note !== undefined ? (body.note ? ' - ' + body.note : '') : (existingLog.note ? ' - ' + existingLog.note : '')}`,
      })
      .where(eq(activityLog.id, existingActivity.id));
  }

  return NextResponse.json(updated);
}
