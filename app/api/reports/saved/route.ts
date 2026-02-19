import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, generatedReports } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reports = await db
    .select({
      id: generatedReports.id,
      type: generatedReports.type,
      periodStart: generatedReports.periodStart,
      periodEnd: generatedReports.periodEnd,
      generatedAt: generatedReports.generatedAt,
      data: generatedReports.data,
    })
    .from(generatedReports)
    .where(eq(generatedReports.userId, session.user.id))
    .orderBy(desc(generatedReports.generatedAt))
    .limit(20);

  return NextResponse.json(reports);
}
