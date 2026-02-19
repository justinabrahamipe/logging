import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, twelveWeekGoals, weeklyTargets, twelveWeekYears } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getTotalWeeks } from "@/lib/twelve-week-scoring";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const periodId = parseInt(id);

  const goals = await db
    .select()
    .from(twelveWeekGoals)
    .where(and(eq(twelveWeekGoals.periodId, periodId), eq(twelveWeekGoals.userId, session.user.id)));

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
    .from(twelveWeekYears)
    .where(and(eq(twelveWeekYears.id, periodId), eq(twelveWeekYears.userId, session.user.id)));

  if (!cycle) {
    return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
  }

  const [goal] = await db.insert(twelveWeekGoals).values({
    periodId,
    userId: session.user.id,
    name,
    targetValue,
    unit,
    linkedOutcomeId: linkedOutcomeId || null,
  }).returning();

  // Auto-generate weekly targets based on cycle duration
  const totalWeeks = getTotalWeeks(cycle.startDate, cycle.endDate);
  const weeklyValue = targetValue / totalWeeks;
  const userId = session.user.id;
  const targetRows = Array.from({ length: totalWeeks }, (_, i) => ({
    goalId: goal.id,
    periodId,
    userId,
    weekNumber: i + 1,
    targetValue: weeklyValue,
  }));

  await db.insert(weeklyTargets).values(targetRows);

  const targets = await db
    .select()
    .from(weeklyTargets)
    .where(eq(weeklyTargets.goalId, goal.id));

  return NextResponse.json({ ...goal, weeklyTargets: targets }, { status: 201 });
}
