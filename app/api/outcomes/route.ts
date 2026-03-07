import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, outcomes, pillars, tasks, twelveWeekYears } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { countScheduledDaysInRange } from "@/lib/effort-calculations";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await db
    .select({
      id: outcomes.id,
      userId: outcomes.userId,
      pillarId: outcomes.pillarId,
      name: outcomes.name,
      startValue: outcomes.startValue,
      targetValue: outcomes.targetValue,
      currentValue: outcomes.currentValue,
      unit: outcomes.unit,
      direction: outcomes.direction,
      logFrequency: outcomes.logFrequency,
      startDate: outcomes.startDate,
      targetDate: outcomes.targetDate,
      periodId: outcomes.periodId,
      goalType: outcomes.goalType,
      scheduleDays: outcomes.scheduleDays,
      autoCreateTasks: outcomes.autoCreateTasks,
      tolerance: outcomes.tolerance,
      completionType: outcomes.completionType,
      dailyTarget: outcomes.dailyTarget,
      linkedOutcomeId: outcomes.linkedOutcomeId,
      isArchived: outcomes.isArchived,
      createdAt: outcomes.createdAt,
      updatedAt: outcomes.updatedAt,
      pillarName: pillars.name,
      pillarColor: pillars.color,
      pillarEmoji: pillars.emoji,
    })
    .from(outcomes)
    .leftJoin(pillars, eq(outcomes.pillarId, pillars.id))
    .where(and(eq(outcomes.userId, session.user.id), eq(outcomes.isArchived, false)));

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, targetValue, unit, pillarId, logFrequency, periodId, goalType, completionType, dailyTarget, scheduleDays, autoCreateTasks, repeatInterval, repeatUnit, linkedOutcomeId, tolerance } = body;

  const isActivityGoal = goalType === 'habitual' || goalType === 'target' || goalType === 'effort';

  if (!name) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!isActivityGoal && (targetValue == null || !unit)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // For activity goals, derive dates from the linked cycle
  let effectiveStartDate = body.startDate || null;
  let effectiveTargetDate = body.targetDate || null;

  if (isActivityGoal && periodId) {
    const [cycle] = await db.select().from(twelveWeekYears).where(eq(twelveWeekYears.id, parseInt(periodId)));
    if (cycle) {
      effectiveStartDate = cycle.startDate;
      effectiveTargetDate = cycle.endDate;
    }
  }

  const effectiveStartValue = isActivityGoal ? 0 : (body.startValue ?? 0);
  const direction = isActivityGoal ? 'increase' : (body.direction || ((targetValue ?? 0) >= effectiveStartValue ? 'increase' : 'decrease'));

  const [outcome] = await db.insert(outcomes).values({
    userId: session.user.id,
    name,
    startValue: effectiveStartValue,
    targetValue: targetValue ?? 0,
    currentValue: effectiveStartValue,
    unit: unit || 'days',
    direction,
    pillarId: pillarId || null,
    logFrequency: logFrequency || (isActivityGoal ? 'daily' : 'weekly'),
    startDate: effectiveStartDate,
    targetDate: effectiveTargetDate,
    periodId: periodId || null,
    goalType: goalType || 'outcome',
    completionType: completionType || 'checkbox',
    dailyTarget: dailyTarget ?? null,
    scheduleDays: scheduleDays ? JSON.stringify(scheduleDays) : null,
    autoCreateTasks: autoCreateTasks || false,
    tolerance: tolerance ?? null,
    linkedOutcomeId: linkedOutcomeId || null,
  }).returning();

  // Auto-create a linked task for activity goals
  if (isActivityGoal && autoCreateTasks && scheduleDays && scheduleDays.length > 0) {
    const isHabitual = goalType === 'habitual';
    const taskCompletionType = completionType || (isHabitual ? 'checkbox' : 'count');
    const totalScheduledDays = (effectiveStartDate && effectiveTargetDate)
      ? (countScheduledDaysInRange(effectiveStartDate, effectiveTargetDate, scheduleDays) || 1)
      : 1;
    const taskDailyTarget = taskCompletionType === 'checkbox' ? null : (dailyTarget || (isHabitual ? null : Math.ceil((targetValue ?? 1) / totalScheduledDays)));

    // Convert repeatUnit to task frequency/repeatInterval
    let taskFrequency = 'custom';
    let taskRepeatInterval: number | null = null;
    const interval = parseInt(repeatInterval) || 1;

    if (repeatUnit === 'days') {
      taskFrequency = 'interval';
      taskRepeatInterval = interval;
    } else if (repeatUnit === 'months') {
      taskFrequency = 'monthly';
      if (interval > 1) taskRepeatInterval = interval;
    } else {
      // weeks (default)
      taskFrequency = 'custom';
      if (interval > 1) taskRepeatInterval = interval * 7;
    }

    await db.insert(tasks).values({
      userId: session.user.id,
      name,
      pillarId: pillarId || null,
      completionType: taskCompletionType,
      target: taskDailyTarget,
      unit: taskCompletionType === 'checkbox' ? null : (unit || null),
      frequency: taskFrequency,
      customDays: JSON.stringify(scheduleDays),
      repeatInterval: taskRepeatInterval,
      outcomeId: outcome.id,
      periodId: periodId || null,
      basePoints: 10,
      flexibilityRule: 'must_today',
      importance: 'medium',
    });
  }

  return NextResponse.json(outcome, { status: 201 });
}
