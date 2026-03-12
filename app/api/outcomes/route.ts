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
      completionType: outcomes.completionType,
      dailyTarget: outcomes.dailyTarget,
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
  const { name, targetValue, unit, pillarId, logFrequency, periodId, goalType, completionType, dailyTarget, scheduleDays, autoCreateTasks, repeatInterval, repeatUnit } = body;

  const isActivityGoal = goalType === 'habitual' || goalType === 'target';

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
      if (!effectiveStartDate) effectiveStartDate = cycle.startDate;
      if (!effectiveTargetDate) effectiveTargetDate = cycle.endDate;
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
    tolerance: null,
    linkedOutcomeId: null,
  }).returning();

  // Auto-create individual tasks for the next 7 days that match the schedule
  if (autoCreateTasks && scheduleDays && scheduleDays.length > 0) {
    const isHabitual = goalType === 'habitual';
    const isOutcome = goalType === 'outcome';
    const taskCompletionType = isOutcome ? 'numeric' : (completionType || (isHabitual ? 'checkbox' : 'count'));
    const totalScheduledDays = (effectiveStartDate && effectiveTargetDate)
      ? (countScheduledDaysInRange(effectiveStartDate, effectiveTargetDate, scheduleDays) || 1)
      : 1;
    const taskDailyTarget = isOutcome
      ? null
      : (taskCompletionType === 'checkbox' ? null : (dailyTarget || (isHabitual ? null : Math.ceil((targetValue ?? 1) / totalScheduledDays))));

    // Generate individual adhoc tasks for each matching day in the next 7 days
    const today = new Date();
    const taskValues = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];

      // Skip dates before the goal's start date
      if (effectiveStartDate && dateStr < effectiveStartDate) continue;
      // Skip dates after the goal's target date
      if (effectiveTargetDate && dateStr > effectiveTargetDate) continue;

      // Check if this day matches the schedule
      const dow = d.getDay();
      if (!scheduleDays.includes(dow)) continue;

      taskValues.push({
        userId: session.user.id,
        name,
        pillarId: pillarId || null,
        completionType: taskCompletionType,
        target: taskDailyTarget,
        unit: taskCompletionType === 'checkbox' ? null : (unit || null),
        frequency: 'adhoc' as const,
        customDays: null,
        repeatInterval: null,
        outcomeId: outcome.id,
        periodId: periodId || null,
        startDate: dateStr,
        basePoints: 10,
        flexibilityRule: 'must_today',
        importance: 'medium',
        toleranceBefore: null,
        toleranceAfter: null,
      });
    }

    if (taskValues.length > 0) {
      await db.insert(tasks).values(taskValues);
    }
  }

  return NextResponse.json(outcome, { status: 201 });
}
