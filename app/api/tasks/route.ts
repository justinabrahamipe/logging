import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, tasks, pillars, taskCompletions } from "@/lib/db";
import { eq, and, asc } from "drizzle-orm";

function isTaskForDate(task: typeof tasks.$inferSelect, dateStr: string): boolean {
  const date = new Date(dateStr + 'T12:00:00');
  const dayOfWeek = date.getDay(); // 0=Sunday
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Weekend-only tasks
  if (task.isWeekendTask && !isWeekend) return false;

  if (task.frequency === 'daily') return true;

  if (task.frequency === 'weekly') {
    // Show weekly tasks on Monday (1) by default, or on weekend if isWeekendTask
    if (task.isWeekendTask) return dayOfWeek === 6; // Saturday
    return dayOfWeek === 1; // Monday
  }

  if (task.frequency === 'custom' && task.customDays) {
    try {
      const days: number[] = JSON.parse(task.customDays);
      return days.includes(dayOfWeek);
    } catch {
      return true;
    }
  }

  return true;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = request.nextUrl.searchParams.get('date');

  const allTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, session.user.id), eq(tasks.isActive, true)))
    .orderBy(asc(tasks.pillarId));

  let filteredTasks = allTasks;
  if (date) {
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

  return NextResponse.json(grouped);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { pillarId, name, completionType, target, unit, flexibilityRule, importance, frequency, customDays, isWeekendTask, basePoints } = body;

  if (!pillarId || !name) {
    return NextResponse.json({ error: "pillarId and name are required" }, { status: 400 });
  }

  // Verify pillar belongs to user
  const pillar = await db
    .select()
    .from(pillars)
    .where(and(eq(pillars.id, pillarId), eq(pillars.userId, session.user.id)));

  if (pillar.length === 0) {
    return NextResponse.json({ error: "Pillar not found" }, { status: 404 });
  }

  const [task] = await db.insert(tasks).values({
    pillarId,
    userId: session.user.id,
    name,
    completionType: completionType || 'checkbox',
    target: target ?? null,
    unit: unit ?? null,
    flexibilityRule: flexibilityRule || 'must_today',
    importance: importance || 'medium',
    frequency: frequency || 'daily',
    customDays: customDays ?? null,
    isWeekendTask: isWeekendTask ?? false,
    basePoints: basePoints ?? 10,
  }).returning();

  return NextResponse.json(task, { status: 201 });
}
