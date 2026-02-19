import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, outcomeLogs, outcomes } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const outcomeId = parseInt(id);

  // Verify ownership
  const [outcome] = await db
    .select()
    .from(outcomes)
    .where(and(eq(outcomes.id, outcomeId), eq(outcomes.userId, session.user.id)));

  if (!outcome) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const logs = await db
    .select()
    .from(outcomeLogs)
    .where(eq(outcomeLogs.outcomeId, outcomeId))
    .orderBy(desc(outcomeLogs.loggedAt));

  return NextResponse.json(logs);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const outcomeId = parseInt(id);
  const body = await request.json();

  if (body.value == null) {
    return NextResponse.json({ error: "Value is required" }, { status: 400 });
  }

  // Verify ownership
  const [outcome] = await db
    .select()
    .from(outcomes)
    .where(and(eq(outcomes.id, outcomeId), eq(outcomes.userId, session.user.id)));

  if (!outcome) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Create log entry
  const [log] = await db.insert(outcomeLogs).values({
    outcomeId,
    userId: session.user.id,
    value: body.value,
    source: body.source || 'manual',
    note: body.note || null,
  }).returning();

  // Update currentValue on the outcome
  await db
    .update(outcomes)
    .set({ currentValue: body.value })
    .where(eq(outcomes.id, outcomeId));

  return NextResponse.json(log, { status: 201 });
}
