import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse, parseId } from "@/lib/api-utils";
import { db, pillars } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { createAutoLog } from "@/lib/auto-log";
import { getOwnedPillar } from "@/lib/db-utils";
import { mapPillarUpdateFields } from "@/lib/task-utils";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();

    const { id } = await params;
    const pillarId = parseId(id);

    const pillar = await getOwnedPillar(pillarId, userId);
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
    const pillarId = parseId(id);
    const body = await request.json();

    const existing = await getOwnedPillar(pillarId, userId);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updateData = mapPillarUpdateFields(body);
    const [updated] = await db
      .update(pillars)
      .set(updateData)
      .where(and(eq(pillars.id, pillarId), eq(pillars.userId, userId)))
      .returning();

    await createAutoLog(userId, `✏️ Pillar updated: ${existing.name}`);
    return NextResponse.json(updated);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();

    const { id } = await params;
    const pillarId = parseId(id);

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
