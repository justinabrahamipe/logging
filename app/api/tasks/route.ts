import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, tasks, pillars, taskCompletions } from "@/lib/db";
import { eq, and, asc } from "drizzle-orm";
import { isTaskForDate } from "@/lib/task-schedule";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = request.nextUrl.searchParams.get('date');
  const showAll = request.nextUrl.searchParams.get('all') === 'true';

  const allTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, session.user.id), eq(tasks.isActive, true)))
    .orderBy(asc(tasks.pillarId));

  let filteredTasks = allTasks;
  if (date && !showAll) {
    filteredTasks = allTasks.filter(t => isTaskForDate(t, date));
  }

  // Get completions for date if provided
  let completions: (typeof taskCompletions.$inferSelect)[] = [];
  if (date) {
    completions = await db
      .select()
      .from(taskCompletions)
      .where(and(eq(taskCompletions.userId, session.user.id), eq(taskCompletions.date, date)));
  }

  // Get pillars for grouping
  const userPillars = await db
    .select()
    .from(pillars)
    .where(and(eq(pillars.userId, session.user.id), eq(pillars.isArchived, false)))
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
      pillar: { id: 0, userId: session.user.id, name: 'No Pillar', emoji: '📋', color: '#6B7280', weight: 0, description: null, isArchived: false, sortOrder: 999, createdAt: new Date(), updatedAt: new Date() } as typeof userPillars[number],
      tasks: ungrouped as typeof grouped[number]['tasks'],
    });
  }

  return NextResponse.json(grouped);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { pillarId, name, completionType, target, unit, flexibilityRule, windowStart, windowEnd, limitValue, frequency, customDays, repeatInterval, toleranceBefore, toleranceAfter, isWeekendTask, basePoints, outcomeId, periodId, startDate } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // Verify pillar belongs to user (if provided)
  if (pillarId) {
    const pillar = await db
      .select()
      .from(pillars)
      .where(and(eq(pillars.id, pillarId), eq(pillars.userId, session.user.id)));

    if (pillar.length === 0) {
      return NextResponse.json({ error: "Pillar not found" }, { status: 404 });
    }
  }

  try {
    const [task] = await db.insert(tasks).values({
      pillarId: pillarId || null,
      userId: session.user.id,
      name,
      completionType: completionType || 'checkbox',
      target: target ?? null,
      unit: unit ?? null,
      flexibilityRule: flexibilityRule || 'must_today',
      windowStart: windowStart ?? null,
      windowEnd: windowEnd ?? null,
      limitValue: limitValue ?? null,
      frequency: frequency || 'daily',
      customDays: customDays ?? null,
      repeatInterval: repeatInterval ?? null,
      toleranceBefore: toleranceBefore ?? null,
      toleranceAfter: toleranceAfter ?? null,
      isWeekendTask: isWeekendTask ?? false,
      basePoints: basePoints ?? 10,
      outcomeId: outcomeId || null,
      periodId: periodId || null,
      startDate: startDate || null,
    }).returning();

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("Failed to create task:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
