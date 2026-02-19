import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, twelveWeekYears } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { calculateEndDate } from "@/lib/twelve-week-scoring";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await db
    .select()
    .from(twelveWeekYears)
    .where(eq(twelveWeekYears.userId, session.user.id))
    .orderBy(desc(twelveWeekYears.startDate));

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, startDate } = body;

  if (!name || !startDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const endDate = calculateEndDate(startDate);

  // Deactivate other active cycles
  await db
    .update(twelveWeekYears)
    .set({ isActive: false })
    .where(eq(twelveWeekYears.userId, session.user.id));

  const [cycle] = await db.insert(twelveWeekYears).values({
    userId: session.user.id,
    name,
    startDate,
    endDate,
    isActive: true,
  }).returning();

  return NextResponse.json(cycle, { status: 201 });
}
