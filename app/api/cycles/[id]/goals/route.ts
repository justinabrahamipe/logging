import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, cycleGoals, cycles } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const periodId = parseInt(id);

  const goals = await db
    .select()
    .from(cycleGoals)
    .where(and(eq(cycleGoals.periodId, periodId), eq(cycleGoals.userId, session.user.id)));

  return NextResponse.json(goals);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const periodId = parseInt(id);
  const body = await request.json();
  const { name, targetValue, unit, linkedOutcomeId } = body;

  if (!name || targetValue == null || !unit) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Verify the cycle exists and belongs to user
  const [cycle] = await db
    .select()
    .from(cycles)
    .where(and(eq(cycles.id, periodId), eq(cycles.userId, session.user.id)));

  if (!cycle) {
    return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
  }

  const [goal] = await db.insert(cycleGoals).values({
    periodId,
    userId: session.user.id,
    name,
    targetValue,
    unit,
    linkedOutcomeId: linkedOutcomeId || null,
  }).returning();

  return NextResponse.json(goal, { status: 201 });
}
