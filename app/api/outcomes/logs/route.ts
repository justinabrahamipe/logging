import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, outcomeLogs } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logs = await db
    .select({
      id: outcomeLogs.id,
      outcomeId: outcomeLogs.outcomeId,
      value: outcomeLogs.value,
      loggedAt: outcomeLogs.loggedAt,
      note: outcomeLogs.note,
    })
    .from(outcomeLogs)
    .where(eq(outcomeLogs.userId, session.user.id))
    .orderBy(desc(outcomeLogs.loggedAt));

  // Group by outcomeId
  const grouped: Record<number, { id: number; value: number; loggedAt: string; note: string | null }[]> = {};
  for (const log of logs) {
    const loggedAt = log.loggedAt instanceof Date ? log.loggedAt.toISOString() : String(log.loggedAt);
    if (!grouped[log.outcomeId]) grouped[log.outcomeId] = [];
    grouped[log.outcomeId].push({ id: log.id, value: log.value, loggedAt, note: log.note });
  }

  return NextResponse.json(grouped);
}
