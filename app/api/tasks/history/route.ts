import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, tasks, pillars, taskCompletions } from "@/lib/db";
import { eq, and, asc, desc, lt } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "30");

  // Get all past completions (before today) with task and pillar info
  const completions = await db
    .select({
      completion: taskCompletions,
      task: tasks,
      pillar: pillars,
    })
    .from(taskCompletions)
    .innerJoin(tasks, eq(taskCompletions.taskId, tasks.id))
    .leftJoin(pillars, eq(tasks.pillarId, pillars.id))
    .where(
      and(
        eq(taskCompletions.userId, session.user.id),
        lt(taskCompletions.date, today)
      )
    )
    .orderBy(desc(taskCompletions.date), asc(tasks.pillarId))
    .limit(limit * 20); // fetch enough rows to cover `limit` days

  // Group by date
  const dateMap = new Map<string, {
    date: string;
    tasks: {
      id: number;
      name: string;
      completionType: string;
      target: number | null;
      unit: string | null;
      goalId: number | null;
      pillarName: string | null;
      pillarColor: string | null;
      pillarEmoji: string | null;
      completed: boolean;
      value: number | null;
      isHighlighted: boolean;
    }[];
  }>();

  for (const row of completions) {
    const date = row.completion.date;
    if (!dateMap.has(date)) {
      if (dateMap.size >= limit) break;
      dateMap.set(date, { date, tasks: [] });
    }
    dateMap.get(date)!.tasks.push({
      id: row.task.id,
      name: row.task.name,
      completionType: row.task.completionType,
      target: row.task.target,
      unit: row.task.unit,
      goalId: row.task.goalId,
      pillarName: row.pillar?.name || null,
      pillarColor: row.pillar?.color || null,
      pillarEmoji: row.pillar?.emoji || null,
      completed: row.completion.completed,
      value: row.completion.value,
      isHighlighted: row.completion.isHighlighted,
    });
  }

  return NextResponse.json(Array.from(dateMap.values()));
}
