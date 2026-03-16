import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, cycles } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { calculateEndDate } from "@/lib/cycle-scoring";

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();

    const result = await db
      .select()
      .from(cycles)
      .where(eq(cycles.userId, userId))
      .orderBy(desc(cycles.startDate));

    return NextResponse.json(result);
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

    // Deactivate other active cycles
    await db
      .update(cycles)
      .set({ isActive: false })
      .where(eq(cycles.userId, userId));

    const [cycle] = await db.insert(cycles).values({
      userId,
      name,
      startDate,
      endDate,
      vision: vision || null,
      theme: theme || null,
      isActive: true,
    }).returning();

    return NextResponse.json(cycle, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
