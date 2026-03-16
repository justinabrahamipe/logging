import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, cycles, goals, tasks, pillars } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { calculateEndDate } from "@/lib/cycle-scoring";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();

    const { id } = await params;
    const periodId = parseInt(id);

    const [cycle] = await db
      .select()
      .from(cycles)
      .where(and(eq(cycles.id, periodId), eq(cycles.userId, userId)));

    if (!cycle) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Fetch goals where periodId matches this cycle
    const goalsList = await db
      .select({
        id: goals.id,
        periodId: goals.periodId,
        userId: goals.userId,
        name: goals.name,
        targetValue: goals.targetValue,
        currentValue: goals.currentValue,
        unit: goals.unit,
        startValue: goals.startValue,
        direction: goals.direction,
        goalType: goals.goalType,
        pillarId: goals.pillarId,
        isArchived: goals.isArchived,
        createdAt: goals.createdAt,
        updatedAt: goals.updatedAt,
      })
      .from(goals)
      .where(and(eq(goals.periodId, periodId), eq(goals.userId, userId)));

    const linkedTasks = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.periodId, periodId), eq(tasks.isActive, true)));

    return NextResponse.json({ ...cycle, goals: goalsList, linkedTasks });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();

    const { id } = await params;
    const periodId = parseInt(id);
    const body = await request.json();

    const existing = await db
      .select()
      .from(cycles)
      .where(and(eq(cycles.id, periodId), eq(cycles.userId, userId)));

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
          .where(eq(cycles.userId, userId));
      }
      updateData.isActive = body.isActive;
    }

    const [updated] = await db
      .update(cycles)
      .set(updateData)
      .where(and(eq(cycles.id, periodId), eq(cycles.userId, userId)))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();

    const { id } = await params;
    const periodId = parseInt(id);

    const deleted = await db
      .delete(cycles)
      .where(and(eq(cycles.id, periodId), eq(cycles.userId, userId)))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
