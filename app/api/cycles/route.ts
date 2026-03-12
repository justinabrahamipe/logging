import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, cycles } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { calculateEndDate } from "@/lib/cycle-scoring";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await db
    .select()
    .from(cycles)
    .where(eq(cycles.userId, session.user.id))
    .orderBy(desc(cycles.startDate));

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    .where(eq(cycles.userId, session.user.id));

  const [cycle] = await db.insert(cycles).values({
    userId: session.user.id,
    name,
    startDate,
    endDate,
    vision: vision || null,
    theme: theme || null,
    isActive: true,
  }).returning();

  return NextResponse.json(cycle, { status: 201 });
}
