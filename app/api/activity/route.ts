import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, activityLog, tasks, pillars } from "@/lib/db";
import { eq, and, gte, lte, like, desc, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const date = params.get('date');
  const from = params.get('from');
  const to = params.get('to');
  const pillarId = params.get('pillarId');
  const taskId = params.get('taskId');
  const search = params.get('search');
  const limit = parseInt(params.get('limit') || '50');
  const offset = parseInt(params.get('offset') || '0');

  const conditions = [eq(activityLog.userId, session.user.id)];

  if (date) {
    // Filter by specific date — match timestamp range for that day
    const dayStart = new Date(date + 'T00:00:00');
    const dayEnd = new Date(date + 'T23:59:59');
    conditions.push(gte(activityLog.timestamp, dayStart));
    conditions.push(lte(activityLog.timestamp, dayEnd));
  } else {
    if (from) {
      conditions.push(gte(activityLog.timestamp, new Date(from + 'T00:00:00')));
    }
    if (to) {
      conditions.push(lte(activityLog.timestamp, new Date(to + 'T23:59:59')));
    }
  }

  if (pillarId) {
    conditions.push(eq(activityLog.pillarId, parseInt(pillarId)));
  }

  if (taskId) {
    conditions.push(eq(activityLog.taskId, parseInt(taskId)));
  }

  // Build the query with joins
  let query = db
    .select({
      id: activityLog.id,
      timestamp: activityLog.timestamp,
      taskId: activityLog.taskId,
      pillarId: activityLog.pillarId,
      action: activityLog.action,
      previousValue: activityLog.previousValue,
      newValue: activityLog.newValue,
      delta: activityLog.delta,
      pointsBefore: activityLog.pointsBefore,
      pointsAfter: activityLog.pointsAfter,
      pointsDelta: activityLog.pointsDelta,
      source: activityLog.source,
      reversalOf: activityLog.reversalOf,
      note: activityLog.note,
      taskName: tasks.name,
      taskCompletionType: tasks.completionType,
      pillarName: pillars.name,
      pillarEmoji: pillars.emoji,
      pillarColor: pillars.color,
    })
    .from(activityLog)
    .leftJoin(tasks, eq(activityLog.taskId, tasks.id))
    .leftJoin(pillars, eq(activityLog.pillarId, pillars.id))
    .where(and(...conditions))
    .orderBy(desc(activityLog.id))
    .limit(limit)
    .offset(offset);

  const entries = await query;

  // Filter by search on task name (done in-app since it's a left join)
  let filtered = entries;
  if (search) {
    const searchLower = search.toLowerCase();
    filtered = entries.filter(e => e.taskName?.toLowerCase().includes(searchLower));
  }

  return NextResponse.json(filtered);
}
