import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, userStats } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getLevelInfo } from "@/lib/scoring";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let stats = await db.query.userStats.findFirst({
    where: eq(userStats.userId, session.user.id),
  });

  if (!stats) {
    // Create default stats
    const [created] = await db.insert(userStats).values({
      userId: session.user.id,
      totalXp: 0,
      level: 1,
      levelTitle: 'Beginner',
      currentStreak: 0,
      bestStreak: 0,
    }).returning();
    stats = created;
  }

  const levelInfo = getLevelInfo(stats.totalXp);

  return NextResponse.json({
    ...stats,
    levelInfo,
  });
}
