import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, tasks, pillars, taskCompletions } from "@/lib/db";
import { eq, and, asc, inArray } from "drizzle-orm";
import { isTaskForDate } from "@/lib/task-schedule";
import { ensureUpcomingTasks } from "@/lib/ensure-upcoming-tasks";

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();

    const date = request.nextUrl.searchParams.get('date');
    const showAll = request.nextUrl.searchParams.get('all') === 'true';

    // Ensure upcoming tasks exist for goals with autoCreateTasks
    await ensureUpcomingTasks(userId);

    const allTasks = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.isActive, true)))
      .orderBy(asc(tasks.pillarId));

    let filteredTasks = allTasks;
    if (date && !showAll) {
      filteredTasks = allTasks.filter(t => isTaskForDate(t, date));

      // For adhoc tasks carried forward, exclude ones already completed on any date
      const adhocIds = filteredTasks
        .filter(t => {
          if (t.frequency !== 'adhoc') return false;
          const effectiveDate = t.startDate || (t.createdAt ? new Date(t.createdAt).toISOString().split('T')[0] : null);
          return effectiveDate && effectiveDate !== date;
        })
        .map(t => t.id);

      if (adhocIds.length > 0) {
        const completedAdhoc = await db
          .select({ taskId: taskCompletions.taskId })
          .from(taskCompletions)
          .where(and(
            eq(taskCompletions.userId, userId),
            inArray(taskCompletions.taskId, adhocIds),
            eq(taskCompletions.completed, true),
          ));
        const completedSet = new Set(completedAdhoc.map(c => c.taskId));
        filteredTasks = filteredTasks.filter(t => !(t.frequency === 'adhoc' && completedSet.has(t.id)));
      }
    }

    // Get completions for date if provided
    let completions: (typeof taskCompletions.$inferSelect)[] = [];
    if (date) {
      completions = await db
        .select()
        .from(taskCompletions)
        .where(and(eq(taskCompletions.userId, userId), eq(taskCompletions.date, date)));
    }

    // Get pillars for grouping
    const userPillars = await db
      .select()
      .from(pillars)
      .where(and(eq(pillars.userId, userId), eq(pillars.isArchived, false)))
      .orderBy(asc(pillars.sortOrder));

    const completionMap = new Map(completions.map(c => [c.taskId, c]));

    const grouped = userPillars.map(pillar => ({
      pillar,
      tasks: filteredTasks
        .filter(t => t.pillarId === pillar.id)
        .map(t => ({
          ...t,
          completion: completionMap.get(t.id) || null,
        })),
    })).filter(g => g.tasks.length > 0);

    // Add ungrouped tasks (no pillar)
    const ungrouped = filteredTasks
      .filter(t => !t.pillarId)
      .map(t => ({ ...t, completion: completionMap.get(t.id) || null }));

    if (ungrouped.length > 0) {
      grouped.push({
        pillar: { id: 0, userId, name: 'No Pillar', emoji: '📋', color: '#6B7280', weight: 0, description: null, isArchived: false, sortOrder: 999, createdAt: new Date(), updatedAt: new Date() } as typeof userPillars[number],
        tasks: ungrouped as typeof grouped[number]['tasks'],
      });
    }

    return NextResponse.json(grouped);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();

    const body = await request.json();
    const { pillarId, name, completionType, target, unit, flexibilityRule, limitValue, frequency, customDays, repeatInterval, toleranceBefore, toleranceAfter, basePoints, goalId, periodId, startDate } = body;

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

    const [task] = await db.insert(tasks).values({
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
      toleranceBefore: toleranceBefore ?? null,
      toleranceAfter: toleranceAfter ?? null,
      basePoints: basePoints ?? 10,
      goalId: goalId || null,
      periodId: periodId || null,
      startDate: startDate || null,
    }).returning();

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
