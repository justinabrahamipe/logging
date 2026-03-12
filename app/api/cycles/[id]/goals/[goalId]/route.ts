import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, cycleGoals } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; goalId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { goalId } = await params;
  const gId = parseInt(goalId);
  const body = await request.json();

  const [existing] = await db
    .select()
    .from(cycleGoals)
    .where(and(eq(cycleGoals.id, gId), eq(cycleGoals.userId, session.user.id)));

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) updateData.name = body.name;
  if (body.unit !== undefined) updateData.unit = body.unit;
  if (body.linkedOutcomeId !== undefined) updateData.linkedOutcomeId = body.linkedOutcomeId || null;
  if (body.targetValue !== undefined) updateData.targetValue = body.targetValue;

  const [updated] = await db
    .update(cycleGoals)
    .set(updateData)
    .where(and(eq(cycleGoals.id, gId), eq(cycleGoals.userId, session.user.id)))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; goalId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { goalId } = await params;
  const gId = parseInt(goalId);

  const deleted = await db
    .delete(cycleGoals)
    .where(and(eq(cycleGoals.id, gId), eq(cycleGoals.userId, session.user.id)))
    .returning();

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
