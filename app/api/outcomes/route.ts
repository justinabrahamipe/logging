import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, outcomes, pillars } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await db
    .select({
      id: outcomes.id,
      userId: outcomes.userId,
      pillarId: outcomes.pillarId,
      name: outcomes.name,
      startValue: outcomes.startValue,
      targetValue: outcomes.targetValue,
      currentValue: outcomes.currentValue,
      unit: outcomes.unit,
      direction: outcomes.direction,
      logFrequency: outcomes.logFrequency,
      targetDate: outcomes.targetDate,
      periodId: outcomes.periodId,
      isArchived: outcomes.isArchived,
      createdAt: outcomes.createdAt,
      updatedAt: outcomes.updatedAt,
      pillarName: pillars.name,
      pillarColor: pillars.color,
      pillarEmoji: pillars.emoji,
    })
    .from(outcomes)
    .leftJoin(pillars, eq(outcomes.pillarId, pillars.id))
    .where(and(eq(outcomes.userId, session.user.id), eq(outcomes.isArchived, false)));

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, startValue, targetValue, unit, pillarId, logFrequency, targetDate, periodId } = body;

  if (!name || startValue == null || targetValue == null || !unit) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const direction = body.direction || (targetValue >= startValue ? 'increase' : 'decrease');

  const [outcome] = await db.insert(outcomes).values({
    userId: session.user.id,
    name,
    startValue,
    targetValue,
    currentValue: startValue,
    unit,
    direction,
    pillarId: pillarId || null,
    logFrequency: logFrequency || 'weekly',
    targetDate: targetDate || null,
    periodId: periodId || null,
  }).returning();

  return NextResponse.json(outcome, { status: 201 });
}
