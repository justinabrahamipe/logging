import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, dailyScores, pillars } from "@/lib/db";
import { eq, and, gte, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const days = parseInt(request.nextUrl.searchParams.get("days") || "30", 10);
  const clampedDays = Math.min(Math.max(days, 1), 365);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - clampedDays);
  const startDateStr = startDate.toISOString().split("T")[0];

  const [scores, userPillars] = await Promise.all([
    db
      .select()
      .from(dailyScores)
      .where(
        and(
          eq(dailyScores.userId, session.user.id),
          gte(dailyScores.date, startDateStr)
        )
      )
      .orderBy(desc(dailyScores.date)),
    db
      .select()
      .from(pillars)
      .where(
        and(
          eq(pillars.userId, session.user.id),
          eq(pillars.isArchived, false)
        )
      ),
  ]);

  const pillarMeta = userPillars.map((p) => ({
    id: p.id,
    name: p.name,
    emoji: p.emoji,
    color: p.color,
    weight: p.weight,
  }));

  const formattedScores = scores.map((s) => ({
    date: s.date,
    actionScore: s.actionScore,
    isPassing: s.isPassing,
    pillarScores: s.pillarScores ? JSON.parse(s.pillarScores) : {},
  }));

  return NextResponse.json({
    scores: formattedScores,
    pillars: pillarMeta,
  });
}
