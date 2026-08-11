import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, tasks, taskSchedules, pillars, goals } from "@/lib/db";
import { eq, and, asc, isNull, or, inArray, sql } from "drizzle-orm";
import { ensureUpcomingTasks, ensureTasksForDate, invalidateTaskCache, recalcTargetGoalTasks } from "@/lib/ensure-upcoming-tasks";
import { getTodayString } from "@/lib/format";
import { createAutoLog } from "@/lib/auto-log";
import { taskCreateSchema } from "@/lib/schemas/task";
import { buildFrozenContext, computeTaskFrozen } from "@/lib/task-mutations";

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
    const userPillarsPromise = db
      .select()
      .from(pillars)
      .where(eq(pillars.userId, userId));

    if (showAll) {
      const todayStr = date || getTodayString();

      // Run all queries in parallel
      const [userPillars, allSchedules, todayTasks, adhocTasks] = await Promise.all([
        userPillarsPromise,
        db.select().from(taskSchedules)
          .where(eq(taskSchedules.userId, userId))
          .orderBy(asc(taskSchedules.pillarId)),
        db.select().from(tasks)
          .where(and(eq(tasks.userId, userId), eq(tasks.date, todayStr), eq(tasks.dismissed, false))),
        db.select().from(tasks)
          .where(and(eq(tasks.userId, userId), isNull(tasks.scheduleId), eq(tasks.dismissed, false)))
          .orderBy(asc(tasks.pillarId)),
      ]);

      const completionBySchedule = new Map(
        todayTasks.filter(t => t.scheduleId).map(t => [t.scheduleId!, t])
      );

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

      // Group tasks by pillarId in a single pass
      const tasksByPillar = new Map<number | null, typeof allItems>();
      for (const item of allItems) {
        const key = item.pillarId || null;
        const list = tasksByPillar.get(key);
        if (list) list.push(item);
        else tasksByPillar.set(key, [item]);
      }

      const grouped = userPillars
        .filter(pillar => tasksByPillar.has(pillar.id))
        .map(pillar => ({ pillar, tasks: tasksByPillar.get(pillar.id)! }));

      const ungrouped = tasksByPillar.get(null);

      if (ungrouped && ungrouped.length > 0) {
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

    const [userPillars, tasksForDate] = await Promise.all([
      userPillarsPromise,
      db.select().from(tasks)
        .where(and(eq(tasks.userId, userId), eq(tasks.date, dateStr), eq(tasks.dismissed, false)))
        .orderBy(asc(tasks.pillarId)),
    ]);

    // Frozen state depends on the linked goal's type — see lib/task-mutations.ts.
    // Computed once per request (goal-type lookup + habitual max-date query) rather
    // than per task.
    const frozenCtx = await buildFrozenContext(userId, tasksForDate, todayStr);

    // Map tasks to include a completion field for backward compat
    const tasksWithCompletion = tasksForDate.map(t => ({
      ...t,
      frequency: 'adhoc' as const,
      customDays: null,
      repeatInterval: null,
      startDate: t.date,
      frozen: computeTaskFrozen(t, frozenCtx),
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

    // Group tasks by pillarId in a single pass
    const tasksByPillar = new Map<number | null, typeof tasksWithCompletion>();
    for (const t of tasksWithCompletion) {
      const key = t.pillarId || null;
      const list = tasksByPillar.get(key);
      if (list) list.push(t);
      else tasksByPillar.set(key, [t]);
    }

    const grouped = userPillars
      .filter(pillar => tasksByPillar.has(pillar.id))
      .map(pillar => ({ pillar, tasks: tasksByPillar.get(pillar.id)! }));

    const ungrouped = tasksByPillar.get(null);
    if (ungrouped && ungrouped.length > 0) {
      grouped.push({
        pillar: { id: 0, userId, name: 'No Pillar', emoji: '📋', color: '#6B7280', defaultBasePoints: 10, description: null, createdAt: new Date(), updatedAt: new Date() } as typeof userPillars[number],
        tasks: ungrouped as typeof grouped[number]['tasks'],
      });
    }

    // For today view, also include uncompleted no-date adhoc tasks and overdue tasks
    let noDateTasks: typeof tasksWithCompletion = [];
    let overdueTasks: typeof tasksWithCompletion = [];
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
        frozen: false,
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

      // Fetch project/habitual goal IDs so we can surface their overdue tasks
      const projectAndHabitualGoalRows = await db
        .select({ id: goals.id, goalType: goals.goalType })
        .from(goals)
        .where(and(eq(goals.userId, userId), or(eq(goals.goalType, 'project'), eq(goals.goalType, 'habitual'))));
      const projectGoalIds = projectAndHabitualGoalRows.filter(g => g.goalType === 'project').map(g => g.id);
      const habitualGoalIds = projectAndHabitualGoalRows.filter(g => g.goalType === 'habitual').map(g => g.id);

      // Overdue = past-dated, not completed/skipped/dismissed, and one of:
      // - a task with no goal (pure ad-hoc, or a plain repeating task not tied to
      //   a goal that imposes a freeze window) — always allowed to linger here
      // - a project-goal subtask — same, always allowed
      // - a habitual-goal task — collapsed below to only its single latest missed
      //   instance per schedule; older misses are frozen instead (see isTaskFrozen)
      const overdueCondition = or(
        isNull(tasks.goalId),
        projectGoalIds.length > 0 ? inArray(tasks.goalId, projectGoalIds) : sql`false`,
        habitualGoalIds.length > 0 ? inArray(tasks.goalId, habitualGoalIds) : sql`false`,
      );
      const overdueRaw = await db
        .select()
        .from(tasks)
        .where(and(
          eq(tasks.userId, userId),
          eq(tasks.completed, false),
          eq(tasks.skipped, false),
          eq(tasks.dismissed, false),
          sql`${tasks.date} != '' AND ${tasks.date} < ${dateStr}`,
          overdueCondition,
        ))
        .orderBy(asc(tasks.date), asc(tasks.pillarId));

      // Collapse habitual-goal rows down to each schedule's single latest missed date
      const latestHabitualByScheduleId = new Map<number, string>();
      for (const t of overdueRaw) {
        if (t.goalId != null && t.scheduleId != null && habitualGoalIds.includes(t.goalId)) {
          const cur = latestHabitualByScheduleId.get(t.scheduleId);
          if (!cur || t.date > cur) latestHabitualByScheduleId.set(t.scheduleId, t.date);
        }
      }
      const overdueFiltered = overdueRaw.filter(t => {
        if (t.goalId == null || !habitualGoalIds.includes(t.goalId) || t.scheduleId == null) return true;
        return t.date === latestHabitualByScheduleId.get(t.scheduleId);
      });

      overdueTasks = overdueFiltered.map(t => ({
        ...t,
        frequency: 'adhoc' as const,
        customDays: null,
        repeatInterval: null,
        startDate: t.date,
        frozen: false,
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

    return NextResponse.json({ groups: grouped, noDateTasks, overdueTasks });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();

    const body = await request.json();
    const result = taskCreateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid input", details: result.error.issues }, { status: 400 });
    }
    const { pillarId, name, completionType, target, unit, flexibilityRule, limitValue, frequency, customDays, repeatInterval, basePoints, goalId, periodId, startDate, endDate, description } = result.data;

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
        description: description || null,
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
        endDate: endDate || null,
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
        description: description || null,
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
