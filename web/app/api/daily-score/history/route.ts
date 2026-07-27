import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, dailyScores, pillars } from "@/lib/db";
import { eq, and, gte, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();

    const rawDays = parseInt(request.nextUrl.searchParams.get("days") || "30", 10);
    const clampedDays = Math.min(Math.max(isNaN(rawDays) ? 30 : rawDays, 1), 365);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - clampedDays);
    const startDateStr = startDate.toISOString().split("T")[0];

    const [scores, userPillars] = await Promise.all([
      db
        .select()
        .from(dailyScores)
        .where(
          and(
            eq(dailyScores.userId, userId),
            gte(dailyScores.date, startDateStr)
          )
        )
        .orderBy(desc(dailyScores.date)),
      db
        .select()
        .from(pillars)
        .where(eq(pillars.userId, userId)),
    ]);

    const pillarMeta = userPillars.map((p) => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      color: p.color,
      defaultBasePoints: p.defaultBasePoints,
    }));

    const formattedScores = scores.map((s) => ({
      date: s.date,
      actionScore: s.actionScore,
      momentumScore: s.momentumScore,
      trajectoryScore: s.trajectoryScore ?? null,
      pillarScores: s.pillarScores ? JSON.parse(s.pillarScores) : {},
      pillarMomentum: s.pillarMomentum ? JSON.parse(s.pillarMomentum) : {},
    }));

    return NextResponse.json({
      scores: formattedScores,
      pillars: pillarMeta,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
