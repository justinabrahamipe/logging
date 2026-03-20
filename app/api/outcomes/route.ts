import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, goals, pillars, tasks, taskSchedules, cycles } from "@/lib/db";
import { eq } from "drizzle-orm";
import { countScheduledDaysInRange } from "@/lib/effort-calculations";

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();

    const result = await db
      .select({
        id: goals.id,
        userId: goals.userId,
        pillarId: goals.pillarId,
        name: goals.name,
        startValue: goals.startValue,
        targetValue: goals.targetValue,
        currentValue: goals.currentValue,
        unit: goals.unit,
        startDate: goals.startDate,
        targetDate: goals.targetDate,
        periodId: goals.periodId,
        goalType: goals.goalType,
        scheduleDays: goals.scheduleDays,
        autoCreateTasks: goals.autoCreateTasks,
        completionType: goals.completionType,
        dailyTarget: goals.dailyTarget,
        flexibilityRule: goals.flexibilityRule,
        limitValue: goals.limitValue,
        minimumTarget: goals.minimumTarget,
        createdAt: goals.createdAt,
        updatedAt: goals.updatedAt,
        pillarName: pillars.name,
        pillarColor: pillars.color,
        pillarEmoji: pillars.emoji,
      })
      .from(goals)
      .leftJoin(pillars, eq(goals.pillarId, pillars.id))
      .where(eq(goals.userId, userId));

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();

    const body = await request.json();
    const { name, targetValue, unit, pillarId, periodId, goalType, completionType, dailyTarget, scheduleDays, autoCreateTasks, flexibilityRule, limitValue, minimumTarget } = body;

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
      const [cycle] = await db.select().from(cycles).where(eq(cycles.id, parseInt(periodId)));
      if (cycle) {
        if (!effectiveStartDate) effectiveStartDate = cycle.startDate;
        if (!effectiveTargetDate) effectiveTargetDate = cycle.endDate;
      }
    }

    const effectiveStartValue = isActivityGoal ? 0 : (body.startValue ?? 0);

    const [outcome] = await db.insert(goals).values({
      userId,
      name,
      startValue: effectiveStartValue,
      targetValue: targetValue ?? 0,
      currentValue: effectiveStartValue,
      unit: unit || 'days',
      pillarId: pillarId || null,
      startDate: effectiveStartDate,
      targetDate: effectiveTargetDate,
      periodId: periodId || null,
      goalType: goalType || 'outcome',
      completionType: completionType || 'checkbox',
      dailyTarget: dailyTarget ?? null,
      scheduleDays: scheduleDays ? JSON.stringify(scheduleDays) : null,
      autoCreateTasks: autoCreateTasks || false,
      flexibilityRule: flexibilityRule || 'must_today',
      limitValue: limitValue ?? null,
      minimumTarget: minimumTarget ?? null,
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

      // Generate individual adhoc task schedules + instances for each matching day
      const today = new Date();
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

        // Create schedule for this adhoc task
        const [schedule] = await db.insert(taskSchedules).values({
          userId,
          name,
          pillarId: pillarId || null,
          completionType: taskCompletionType,
          target: taskDailyTarget,
          unit: taskCompletionType === 'checkbox' ? null : (unit || null),
          frequency: 'adhoc',
          customDays: null,
          repeatInterval: null,
          goalId: outcome.id,
          periodId: periodId || null,
          startDate: dateStr,
          basePoints: 10,
          flexibilityRule: flexibilityRule || 'must_today',
          limitValue: (flexibilityRule === 'limit_avoid' ? (dailyTarget || limitValue || null) : null),
        }).returning();

        // Create the concrete task instance
        const isLimit = flexibilityRule === 'limit_avoid';
        const taskLimitValue = isLimit ? (dailyTarget || limitValue || null) : null;
        await db.insert(tasks).values({
          scheduleId: schedule.id,
          userId,
          name,
          pillarId: pillarId || null,
          completionType: taskCompletionType,
          target: taskDailyTarget,
          unit: taskCompletionType === 'checkbox' ? null : (unit || null),
          goalId: outcome.id,
          periodId: periodId || null,
          date: dateStr,
          basePoints: 10,
          flexibilityRule: flexibilityRule || 'must_today',
          limitValue: taskLimitValue,
          minimumTarget: minimumTarget ?? null,
          value: isLimit && taskLimitValue ? taskLimitValue : null,
        });
      }
    }

    return NextResponse.json(outcome, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
