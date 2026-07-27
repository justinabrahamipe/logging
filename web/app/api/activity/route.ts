import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, activityLog, tasks, pillars } from "@/lib/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();

    const params = request.nextUrl.searchParams;
    const date = params.get('date');
    const from = params.get('from');
    const to = params.get('to');
    const pillarId = params.get('pillarId');
    const taskId = params.get('taskId');
    const search = params.get('search');
    const limit = Math.min(Math.max(parseInt(params.get('limit') || '50', 10) || 50, 1), 500);
    const offset = Math.max(parseInt(params.get('offset') || '0', 10) || 0, 0);

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const isValidDate = (d: string | null) => d && dateRegex.test(d);
    const conditions = [eq(activityLog.userId, userId)];

    if (isValidDate(date)) {
      const dayStart = new Date(date + 'T00:00:00');
      const dayEnd = new Date(date + 'T23:59:59');
      conditions.push(gte(activityLog.timestamp, dayStart));
      conditions.push(lte(activityLog.timestamp, dayEnd));
    } else if (!date) {
      if (isValidDate(from)) {
        conditions.push(gte(activityLog.timestamp, new Date(from + 'T00:00:00')));
      }
      if (isValidDate(to)) {
        conditions.push(lte(activityLog.timestamp, new Date(to + 'T23:59:59')));
      }
    }

    if (pillarId) {
      const pid = parseInt(pillarId, 10);
      if (!isNaN(pid) && pid > 0) conditions.push(eq(activityLog.pillarId, pid));
    }

    if (taskId) {
      const tid = parseInt(taskId, 10);
      if (!isNaN(tid) && tid > 0) conditions.push(eq(activityLog.taskId, tid));
    }

    // Build the query with joins (no longer joining outcomeLogs)
    const query = db
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

    const mapped = entries.map(e => ({
      ...e,
      outcomeLogValue: e.action === 'outcome_log' ? e.newValue : null,
    }));

    // Filter by search on task name (done in-app since it's a left join)
    let filtered = mapped;
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = mapped.filter(e => e.taskName?.toLowerCase().includes(searchLower));
    }

    return NextResponse.json(filtered);
  } catch (error) {
    return errorResponse(error);
  }
}
