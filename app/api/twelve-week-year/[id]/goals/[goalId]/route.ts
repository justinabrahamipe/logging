import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, twelveWeekGoals, weeklyTargets } from "@/lib/db";
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
    .from(twelveWeekGoals)
    .where(and(eq(twelveWeekGoals.id, gId), eq(twelveWeekGoals.userId, session.user.id)));

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) updateData.name = body.name;
  if (body.unit !== undefined) updateData.unit = body.unit;
  if (body.linkedOutcomeId !== undefined) updateData.linkedOutcomeId = body.linkedOutcomeId || null;

  const targetChanged = body.targetValue !== undefined && body.targetValue !== existing.targetValue;
  if (body.targetValue !== undefined) updateData.targetValue = body.targetValue;

  const [updated] = await db
    .update(twelveWeekGoals)
    .set(updateData)
    .where(and(eq(twelveWeekGoals.id, gId), eq(twelveWeekGoals.userId, session.user.id)))
    .returning();

  // If target changed, recalculate non-overridden weekly targets
  if (targetChanged) {
    const targets = await db
      .select()
      .from(weeklyTargets)
      .where(eq(weeklyTargets.goalId, gId));

    const nonOverridden = targets.filter((t) => !t.isOverridden);
    const overriddenTotal = targets
      .filter((t) => t.isOverridden)
      .reduce((sum, t) => sum + t.targetValue, 0);

    const remaining = body.targetValue - overriddenTotal;
    const perWeek = nonOverridden.length > 0 ? remaining / nonOverridden.length : 0;

    for (const t of nonOverridden) {
      await db
        .update(weeklyTargets)
        .set({ targetValue: perWeek })
        .where(eq(weeklyTargets.id, t.id));
    }
  }

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
    .delete(twelveWeekGoals)
    .where(and(eq(twelveWeekGoals.id, gId), eq(twelveWeekGoals.userId, session.user.id)))
    .returning();

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
