import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, outcomes } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const outcomeId = parseInt(id);
  const body = await request.json();

  const existing = await db
    .select()
    .from(outcomes)
    .where(and(eq(outcomes.id, outcomeId), eq(outcomes.userId, session.user.id)));

  if (existing.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.pillarId !== undefined) updateData.pillarId = body.pillarId || null;
  if (body.targetValue !== undefined) updateData.targetValue = body.targetValue;
  if (body.unit !== undefined) updateData.unit = body.unit;
  if (body.direction !== undefined) updateData.direction = body.direction;
  if (body.logFrequency !== undefined) updateData.logFrequency = body.logFrequency;
  if (body.targetDate !== undefined) updateData.targetDate = body.targetDate || null;
  if (body.periodId !== undefined) updateData.periodId = body.periodId || null;

  const [updated] = await db
    .update(outcomes)
    .set(updateData)
    .where(and(eq(outcomes.id, outcomeId), eq(outcomes.userId, session.user.id)))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const outcomeId = parseInt(id);

  const [updated] = await db
    .update(outcomes)
    .set({ isArchived: true })
    .where(and(eq(outcomes.id, outcomeId), eq(outcomes.userId, session.user.id)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
