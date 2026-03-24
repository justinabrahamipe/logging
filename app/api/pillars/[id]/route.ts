import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, pillars } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { createAutoLog } from "@/lib/auto-log";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();

    const { id } = await params;
    const pillarId = parseInt(id);

    const [pillar] = await db
      .select()
      .from(pillars)
      .where(and(eq(pillars.id, pillarId), eq(pillars.userId, userId)));

    if (!pillar) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(pillar);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();

    const { id } = await params;
    const pillarId = parseInt(id);
    const body = await request.json();

    const existing = await db
      .select()
      .from(pillars)
      .where(and(eq(pillars.id, pillarId), eq(pillars.userId, userId)));

    if (existing.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.emoji !== undefined) updateData.emoji = body.emoji;
    if (body.color !== undefined) updateData.color = body.color;
    if (body.weight !== undefined) updateData.weight = body.weight;
    if (body.description !== undefined) updateData.description = body.description;
    const [updated] = await db
      .update(pillars)
      .set(updateData)
      .where(and(eq(pillars.id, pillarId), eq(pillars.userId, userId)))
      .returning();

    await createAutoLog(userId, `✏️ Pillar updated: ${existing[0].name}`);
    return NextResponse.json(updated);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();

    const { id } = await params;
    const pillarId = parseInt(id);

    const deleted = await db
      .delete(pillars)
      .where(and(eq(pillars.id, pillarId), eq(pillars.userId, userId)))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await createAutoLog(userId, `🗑️ Pillar deleted: ${deleted[0].name}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
