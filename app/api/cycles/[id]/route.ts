import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, cycles, cycleGoals, goals, cycleTactics, weeklyReviews, tasks } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { calculateEndDate } from "@/lib/cycle-scoring";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const periodId = parseInt(id);

  const [cycle] = await db
    .select()
    .from(cycles)
    .where(and(eq(cycles.id, periodId), eq(cycles.userId, session.user.id)));

  if (!cycle) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const cycleGoalsList = await db
    .select({
      id: cycleGoals.id,
      periodId: cycleGoals.periodId,
      userId: cycleGoals.userId,
      name: cycleGoals.name,
      targetValue: cycleGoals.targetValue,
      currentValue: cycleGoals.currentValue,
      unit: cycleGoals.unit,
      linkedOutcomeId: cycleGoals.linkedOutcomeId,
      createdAt: cycleGoals.createdAt,
      updatedAt: cycleGoals.updatedAt,
      outcomeName: goals.name,
    })
    .from(cycleGoals)
    .leftJoin(goals, eq(cycleGoals.linkedOutcomeId, goals.id))
    .where(eq(cycleGoals.periodId, periodId));

  const tactics = await db
    .select()
    .from(cycleTactics)
    .where(eq(cycleTactics.periodId, periodId));

  const reviews = await db
    .select()
    .from(weeklyReviews)
    .where(eq(weeklyReviews.periodId, periodId));

  const linkedTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.periodId, periodId), eq(tasks.isActive, true)));

  // Attach tactics to goals
  const goalsWithTactics = cycleGoalsList.map((g) => ({
    ...g,
    tactics: tactics.filter((t) => t.goalId === g.id),
  }));

  return NextResponse.json({ ...cycle, goals: goalsWithTactics, weeklyReviews: reviews, linkedTasks });
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
    .from(cycles)
    .where(and(eq(cycles.id, periodId), eq(cycles.userId, session.user.id)));

  if (existing.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) updateData.name = body.name;
  if (body.startDate !== undefined) {
    updateData.startDate = body.startDate;
    if (!body.endDate) updateData.endDate = calculateEndDate(body.startDate);
  }
  if (body.endDate !== undefined) updateData.endDate = body.endDate;
  if (body.vision !== undefined) updateData.vision = body.vision || null;
  if (body.theme !== undefined) updateData.theme = body.theme || null;
  if (body.isActive !== undefined) {
    if (body.isActive) {
      // Deactivate others first
      await db
        .update(cycles)
        .set({ isActive: false })
        .where(eq(cycles.userId, session.user.id));
    }
    updateData.isActive = body.isActive;
  }

  const [updated] = await db
    .update(cycles)
    .set(updateData)
    .where(and(eq(cycles.id, periodId), eq(cycles.userId, session.user.id)))
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
    .delete(cycles)
    .where(and(eq(cycles.id, periodId), eq(cycles.userId, session.user.id)))
    .returning();

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
