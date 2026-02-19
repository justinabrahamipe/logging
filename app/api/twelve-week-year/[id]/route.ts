import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, twelveWeekYears, twelveWeekGoals, weeklyTargets, outcomes } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { calculateEndDate } from "@/lib/twelve-week-scoring";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const periodId = parseInt(id);

  const [cycle] = await db
    .select()
    .from(twelveWeekYears)
    .where(and(eq(twelveWeekYears.id, periodId), eq(twelveWeekYears.userId, session.user.id)));

  if (!cycle) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const goals = await db
    .select({
      id: twelveWeekGoals.id,
      periodId: twelveWeekGoals.periodId,
      userId: twelveWeekGoals.userId,
      name: twelveWeekGoals.name,
      targetValue: twelveWeekGoals.targetValue,
      currentValue: twelveWeekGoals.currentValue,
      unit: twelveWeekGoals.unit,
      linkedOutcomeId: twelveWeekGoals.linkedOutcomeId,
      createdAt: twelveWeekGoals.createdAt,
      updatedAt: twelveWeekGoals.updatedAt,
      outcomeName: outcomes.name,
    })
    .from(twelveWeekGoals)
    .leftJoin(outcomes, eq(twelveWeekGoals.linkedOutcomeId, outcomes.id))
    .where(eq(twelveWeekGoals.periodId, periodId));

  const targets = await db
    .select()
    .from(weeklyTargets)
    .where(eq(weeklyTargets.periodId, periodId));

  return NextResponse.json({ ...cycle, goals, weeklyTargets: targets });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const periodId = parseInt(id);
  const body = await request.json();

  const existing = await db
    .select()
    .from(twelveWeekYears)
    .where(and(eq(twelveWeekYears.id, periodId), eq(twelveWeekYears.userId, session.user.id)));

  if (existing.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.startDate !== undefined) {
    updateData.startDate = body.startDate;
    updateData.endDate = calculateEndDate(body.startDate);
  }
  if (body.isActive !== undefined) {
    if (body.isActive) {
      // Deactivate others first
      await db
        .update(twelveWeekYears)
        .set({ isActive: false })
        .where(eq(twelveWeekYears.userId, session.user.id));
    }
    updateData.isActive = body.isActive;
  }

  const [updated] = await db
    .update(twelveWeekYears)
    .set(updateData)
    .where(and(eq(twelveWeekYears.id, periodId), eq(twelveWeekYears.userId, session.user.id)))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const periodId = parseInt(id);

  const deleted = await db
    .delete(twelveWeekYears)
    .where(and(eq(twelveWeekYears.id, periodId), eq(twelveWeekYears.userId, session.user.id)))
    .returning();

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
