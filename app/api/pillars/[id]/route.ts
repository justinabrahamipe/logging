import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, pillars } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const pillarId = parseInt(id);
  const body = await request.json();

  const existing = await db
    .select()
    .from(pillars)
    .where(and(eq(pillars.id, pillarId), eq(pillars.userId, session.user.id)));

  if (existing.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.emoji !== undefined) updateData.emoji = body.emoji;
  if (body.color !== undefined) updateData.color = body.color;
  if (body.weight !== undefined) updateData.weight = body.weight;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.isArchived !== undefined) updateData.isArchived = body.isArchived;
  if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;

  const [updated] = await db
    .update(pillars)
    .set(updateData)
    .where(and(eq(pillars.id, pillarId), eq(pillars.userId, session.user.id)))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const pillarId = parseInt(id);

  // Soft delete (archive)
  const [updated] = await db
    .update(pillars)
    .set({ isArchived: true })
    .where(and(eq(pillars.id, pillarId), eq(pillars.userId, session.user.id)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
