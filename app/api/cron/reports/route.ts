import { NextRequest, NextResponse } from "next/server";
import { db, users, generatedReports } from "@/lib/db";
import { computeReport } from "@/lib/reports";

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = request.nextUrl.searchParams.get("type") || "weekly";

  // Get all users
  const allUsers = await db.select({ id: users.id }).from(users);

  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() - 1); // Yesterday as end of period
  const endStr = endDate.toISOString().split("T")[0];

  const startDate = new Date(endDate);
  if (type === "monthly") {
    startDate.setDate(startDate.getDate() - 29);
  } else {
    startDate.setDate(startDate.getDate() - 6);
  }
  const startStr = startDate.toISOString().split("T")[0];

  let generated = 0;
  let skipped = 0;

  for (const user of allUsers) {
    try {
      const report = await computeReport(user.id, type, endStr);

      // Upsert: insert or ignore if unique constraint hit
      await db.insert(generatedReports).values({
        userId: user.id,
        type,
        periodStart: startStr,
        periodEnd: endStr,
        data: JSON.stringify(report),
      }).onConflictDoUpdate({
        target: [generatedReports.userId, generatedReports.type, generatedReports.periodStart],
        set: {
          data: JSON.stringify(report),
          periodEnd: endStr,
          generatedAt: new Date(),
        },
      });

      generated++;
    } catch (error) {
      console.error(`Failed to generate ${type} report for user ${user.id}:`, error);
      skipped++;
    }
  }

  return NextResponse.json({
    success: true,
    type,
    period: { start: startStr, end: endStr },
    generated,
    skipped,
  });
}
