import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, tasks, taskSchedules, pillars } from "@/lib/db";
import { eq, and, asc, isNull, sql } from "drizzle-orm";
import { ensureUpcomingTasks, ensureTasksForDate, invalidateTaskCache, recalcTargetGoalTasks } from "@/lib/ensure-upcoming-tasks";
import { getTodayString } from "@/lib/format";
import { createAutoLog } from "@/lib/auto-log";

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();

    const date = request.nextUrl.searchParams.get('date');
    const showAll = request.nextUrl.searchParams.get('all') === 'true' || !date;

    // Ensure upcoming task instances exist
    await ensureUpcomingTasks(userId);

    // Recalculate per-session targets for target goals (remaining work / remaining days)
    await recalcTargetGoalTasks(userId);

    // If requesting a specific date beyond the 7-day window, generate on-the-fly
    if (date && !showAll) {
      await ensureTasksForDate(userId, date);
    }

    // Get pillars for grouping
    const userPillars = await db
      .select()
      .from(pillars)
      .where(eq(pillars.userId, userId));

    if (showAll) {
      // Return all task schedules (for week/month/scheduled views that need client-side bucketing)
      const allSchedules = await db
        .select()
        .from(taskSchedules)
        .where(eq(taskSchedules.userId, userId))
        .orderBy(asc(taskSchedules.pillarId));

      // For the all view, fetch today's completions to attach
      const todayStr = date || getTodayString();
      const todayTasks = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.userId, userId), eq(tasks.date, todayStr), eq(tasks.dismissed, false)));

      const completionBySchedule = new Map(
        todayTasks.filter(t => t.scheduleId).map(t => [t.scheduleId!, t])
      );

      // Also fetch adhoc tasks (no schedule) for inclusion in the all view
      const adhocTasks = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.userId, userId), isNull(tasks.scheduleId), eq(tasks.dismissed, false)))
        .orderBy(asc(tasks.pillarId));

      const adhocTaskItems = adhocTasks
        .map(t => ({
          ...t,
          frequency: 'adhoc' as const,
          customDays: null,
          repeatInterval: null,
          startDate: t.date,
          completion: {
            id: t.id,
            taskId: t.id,
            completed: t.completed,
            value: t.value,
            pointsEarned: t.pointsEarned,
            isHighlighted: t.isHighlighted,
            skipped: t.skipped,
            timerStartedAt: t.timerStartedAt,
          },
        }));

      const scheduleItems = allSchedules.map(s => {
        const taskInstance = completionBySchedule.get(s.id);
        return {
          ...s,
          completion: taskInstance ? {
            id: taskInstance.id,
            taskId: taskInstance.id,
            completed: taskInstance.completed,
            value: taskInstance.value,
            pointsEarned: taskInstance.pointsEarned,
            isHighlighted: taskInstance.isHighlighted,
            timerStartedAt: taskInstance.timerStartedAt,
          } : null,
        };
      });

      const allItems = [...scheduleItems, ...adhocTaskItems];

      const grouped = userPillars.map(pillar => ({
        pillar,
        tasks: allItems.filter(s => s.pillarId === pillar.id),
      })).filter(g => g.tasks.length > 0);

      // Add ungrouped (no pillar)
      const ungrouped = allItems.filter(s => !s.pillarId);

      if (ungrouped.length > 0) {
        grouped.push({
          pillar: { id: 0, userId, name: 'No Pillar', emoji: '📋', color: '#6B7280', defaultBasePoints: 10, description: null, createdAt: new Date(), updatedAt: new Date() } as typeof userPillars[number],
          tasks: ungrouped as typeof grouped[number]['tasks'],
        });
      }

      return NextResponse.json(grouped);
    }

    // Date-specific view: return concrete task instances for the date
    const dateStr = date || getTodayString();
    const todayStr = getTodayString();
    const isToday = dateStr === todayStr;

    const tasksForDate = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.date, dateStr), eq(tasks.dismissed, false)))
      .orderBy(asc(tasks.pillarId));

    // Map tasks to include a completion field for backward compat
    const tasksWithCompletion = tasksForDate.map(t => ({
      ...t,
      // Include schedule fields for client compat (frequency etc. used by getDateBucket)
      frequency: 'adhoc' as const,
      customDays: null,
      repeatInterval: null,
      startDate: t.date,
      completion: {
        id: t.id,
        taskId: t.id,
        completed: t.completed,
        value: t.value,
        pointsEarned: t.pointsEarned,
        isHighlighted: t.isHighlighted,
        skipped: t.skipped,
        timerStartedAt: t.timerStartedAt,
      },
    }));

    const grouped = userPillars.map(pillar => ({
      pillar,
      tasks: tasksWithCompletion.filter(t => t.pillarId === pillar.id),
    })).filter(g => g.tasks.length > 0);

    // Add ungrouped tasks (no pillar)
    const ungrouped = tasksWithCompletion.filter(t => !t.pillarId);
    if (ungrouped.length > 0) {
      grouped.push({
        pillar: { id: 0, userId, name: 'No Pillar', emoji: '📋', color: '#6B7280', defaultBasePoints: 10, description: null, createdAt: new Date(), updatedAt: new Date() } as typeof userPillars[number],
        tasks: ungrouped as typeof grouped[number]['tasks'],
      });
    }

    // For today view, also include uncompleted no-date adhoc tasks
    let noDateTasks: typeof tasksWithCompletion = [];
    if (isToday) {
      const noDateRaw = await db
        .select()
        .from(tasks)
        .where(and(
          eq(tasks.userId, userId),
          isNull(tasks.scheduleId),
          eq(tasks.completed, false),
          eq(tasks.dismissed, false),
          eq(tasks.date, ''),
        ))
        .orderBy(asc(tasks.pillarId));

      noDateTasks = noDateRaw.map(t => ({
        ...t,
        frequency: 'adhoc' as const,
        customDays: null,
        repeatInterval: null,
        startDate: t.date,
        completion: {
          id: t.id,
          taskId: t.id,
          completed: t.completed,
          value: t.value,
          pointsEarned: t.pointsEarned,
          isHighlighted: t.isHighlighted,
          skipped: t.skipped,
          timerStartedAt: t.timerStartedAt,
        },
      }));
    }

    return NextResponse.json({ groups: grouped, noDateTasks });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();

    const body = await request.json();
    const { pillarId, name, completionType, target, unit, flexibilityRule, limitValue, frequency, customDays, repeatInterval, basePoints, goalId, periodId, startDate } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    // Verify pillar belongs to user (if provided)
    if (pillarId) {
      const pillar = await db
        .select()
        .from(pillars)
        .where(and(eq(pillars.id, pillarId), eq(pillars.userId, userId)));

      if (pillar.length === 0) {
        return NextResponse.json({ error: "Pillar not found" }, { status: 404 });
      }
    }

    const isRecurring = frequency && frequency !== 'adhoc';

    if (isRecurring) {
      // Create a task schedule for recurring tasks
      const [schedule] = await db.insert(taskSchedules).values({
        pillarId: pillarId || null,
        userId,
        name,
        completionType: completionType || 'checkbox',
        target: target ?? null,
        unit: unit ?? null,
        flexibilityRule: flexibilityRule || 'must_today',
        limitValue: limitValue ?? null,
        frequency: frequency || 'daily',
        customDays: customDays ?? null,
        repeatInterval: repeatInterval ?? null,
        basePoints: basePoints ?? 10,
        goalId: goalId || null,
        periodId: periodId || null,
        startDate: startDate || null,
      }).returning();

      // Invalidate cache and generate task instances for today + 7 days
      invalidateTaskCache(userId);
      await ensureUpcomingTasks(userId);

      await createAutoLog(userId, `➕ Task created: ${name}`);
      return NextResponse.json(schedule, { status: 201 });
    } else {
      // Create adhoc task directly in the tasks table (no schedule needed)
      // If no startDate provided, leave as empty string (no-date task)
      const taskDate = startDate || '';

      const [task] = await db.insert(tasks).values({
        pillarId: pillarId || null,
        userId,
        name,
        completionType: completionType || 'checkbox',
        target: target ?? null,
        unit: unit ?? null,
        flexibilityRule: flexibilityRule || 'must_today',
        limitValue: limitValue ?? null,
        basePoints: basePoints ?? 10,
        goalId: goalId || null,
        periodId: periodId || null,
        date: taskDate,
      }).returning();

      await createAutoLog(userId, `➕ Task created: ${name}`);
      return NextResponse.json({
        ...task,
        frequency: 'adhoc',
        customDays: null,
        repeatInterval: null,
        startDate: taskDate,
        taskId: task.id,
      }, { status: 201 });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
