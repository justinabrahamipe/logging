import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, cycles } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { calculateEndDate } from "@/lib/cycle-scoring";
import { getTodayString } from "@/lib/format";
import { createAutoLog } from "@/lib/auto-log";

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();

    const result = await db
      .select()
      .from(cycles)
      .where(eq(cycles.userId, userId))
      .orderBy(desc(cycles.startDate));

    const todayStr = getTodayString();
    const withActive = result.map(c => ({
      ...c,
      isActive: todayStr >= c.startDate && todayStr <= c.endDate,
    }));

    return NextResponse.json(withActive);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();

    const body = await request.json();
    const { name, startDate, endDate: customEndDate, vision, theme } = body;

    if (!name || !startDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const endDate = customEndDate || calculateEndDate(startDate);

    const [cycle] = await db.insert(cycles).values({
      userId,
      name,
      startDate,
      endDate,
      vision: vision || null,
      theme: theme || null,
    }).returning();

    await createAutoLog(userId, `📅 Cycle created: ${name}`);
    const todayStr = getTodayString();
    return NextResponse.json({
      ...cycle,
      isActive: todayStr >= cycle.startDate && todayStr <= cycle.endDate,
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
