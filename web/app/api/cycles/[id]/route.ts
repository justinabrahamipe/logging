import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse, parseId } from "@/lib/api-utils";
import { db, cycles, goals, taskSchedules, pillars } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { calculateEndDate } from "@/lib/cycle-scoring";
import { getTodayString } from "@/lib/format";
import { createAutoLog } from "@/lib/auto-log";
import { getOwnedCycle } from "@/lib/db-utils";
import { mapCycleUpdateFields } from "@/lib/task-utils";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();

    const { id } = await params;
    const periodId = parseId(id);

    const cycle = await getOwnedCycle(periodId, userId);
    if (!cycle) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Fetch goals where periodId matches this cycle
    const goalsList = await db
      .select({
        id: goals.id,
        periodId: goals.periodId,
        userId: goals.userId,
        pillarId: goals.pillarId,
        name: goals.name,
        targetValue: goals.targetValue,
        currentValue: goals.currentValue,
        startValue: goals.startValue,
        unit: goals.unit,
        startDate: goals.startDate,
        targetDate: goals.targetDate,
        goalType: goals.goalType,
        completionType: goals.completionType,
        dailyTarget: goals.dailyTarget,
        scheduleDays: goals.scheduleDays,
        status: goals.status,
        flexibilityRule: goals.flexibilityRule,
        limitValue: goals.limitValue,
        autoCreateTasks: goals.autoCreateTasks,
        createdAt: goals.createdAt,
        updatedAt: goals.updatedAt,
        pillarName: pillars.name,
        pillarColor: pillars.color,
        pillarEmoji: pillars.emoji,
      })
      .from(goals)
      .leftJoin(pillars, eq(goals.pillarId, pillars.id))
      .where(and(eq(goals.periodId, periodId), eq(goals.userId, userId)));

    const linkedTasks = await db
      .select()
      .from(taskSchedules)
      .where(eq(taskSchedules.periodId, periodId));

    const todayStr = getTodayString();
    return NextResponse.json({
      ...cycle,
      isActive: todayStr >= cycle.startDate && todayStr <= cycle.endDate,
      goals: goalsList,
      linkedTasks,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();

    const { id } = await params;
    const periodId = parseId(id);
    const body = await request.json();

    const existing = await getOwnedCycle(periodId, userId);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { ...mapCycleUpdateFields(body), updatedAt: new Date() };
    // Auto-derive endDate from startDate when only startDate is provided
    if (body.startDate !== undefined && !body.endDate) {
      updateData.endDate = calculateEndDate(body.startDate);
    }

    const [updated] = await db
      .update(cycles)
      .set(updateData)
      .where(and(eq(cycles.id, periodId), eq(cycles.userId, userId)))
      .returning();

    await createAutoLog(userId, `✏️ Cycle updated: ${existing.name}`);
    const todayStr = getTodayString();
    return NextResponse.json({
      ...updated,
      isActive: todayStr >= updated.startDate && todayStr <= updated.endDate,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();

    const { id } = await params;
    const periodId = parseId(id);

    const deleted = await db
      .delete(cycles)
      .where(and(eq(cycles.id, periodId), eq(cycles.userId, userId)))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await createAutoLog(userId, `🗑️ Cycle deleted: ${deleted[0].name}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
