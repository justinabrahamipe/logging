import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, twelveWeekTactics, twelveWeekGoals } from "@/lib/db";
import { eq, and, asc } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; goalId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { goalId } = await params;
  const gId = parseInt(goalId);

  const tactics = await db
    .select()
    .from(twelveWeekTactics)
    .where(and(eq(twelveWeekTactics.goalId, gId), eq(twelveWeekTactics.userId, session.user.id)))
    .orderBy(asc(twelveWeekTactics.sortOrder));

  return NextResponse.json(tactics);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; goalId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, goalId } = await params;
  const periodId = parseInt(id);
  const gId = parseInt(goalId);
  const body = await request.json();

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Verify goal ownership
  const [goal] = await db
    .select()
    .from(twelveWeekGoals)
    .where(and(eq(twelveWeekGoals.id, gId), eq(twelveWeekGoals.userId, session.user.id)));

  if (!goal) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  // Get max sort order
  const existing = await db
    .select()
    .from(twelveWeekTactics)
    .where(eq(twelveWeekTactics.goalId, gId));

  const maxSort = existing.reduce((max, t) => Math.max(max, t.sortOrder), -1);

  const [tactic] = await db.insert(twelveWeekTactics).values({
    goalId: gId,
    periodId,
    userId: session.user.id,
    name: body.name.trim(),
    description: body.description || null,
    sortOrder: maxSort + 1,
  }).returning();

  return NextResponse.json(tactic, { status: 201 });
}

export async function PUT(
  request: Request,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _context: { params: Promise<{ id: string; goalId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { tacticId } = body;

  if (!tacticId) {
    return NextResponse.json({ error: "tacticId is required" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(twelveWeekTactics)
    .where(and(eq(twelveWeekTactics.id, tacticId), eq(twelveWeekTactics.userId, session.user.id)));

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.isCompleted !== undefined) updateData.isCompleted = body.isCompleted;
  if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;

  const [updated] = await db
    .update(twelveWeekTactics)
    .set(updateData)
    .where(eq(twelveWeekTactics.id, tacticId))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _context: { params: Promise<{ id: string; goalId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tacticId = parseInt(searchParams.get("tacticId") || "0");

  if (!tacticId) {
    return NextResponse.json({ error: "tacticId query param required" }, { status: 400 });
  }

  const deleted = await db
    .delete(twelveWeekTactics)
    .where(and(eq(twelveWeekTactics.id, tacticId), eq(twelveWeekTactics.userId, session.user.id)))
    .returning();

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
