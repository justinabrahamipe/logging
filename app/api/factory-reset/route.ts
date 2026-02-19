import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  db, pillars, tasks, taskCompletions, dailyScores, userStats,
  outcomes, outcomeLogs, activityLog,
  twelveWeekYears, twelveWeekGoals, twelveWeekTactics, weeklyTargets, weeklyReviews,
  generatedReports, userPreferences,
} from "@/lib/db";
import { eq } from "drizzle-orm";
import { seedDefaultData } from "@/lib/seed-data";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    await db.transaction(async (tx) => {
      // Delete all user data (order matters due to FKs)
      await tx.delete(taskCompletions).where(eq(taskCompletions.userId, userId));
      await tx.delete(dailyScores).where(eq(dailyScores.userId, userId));
      await tx.delete(userStats).where(eq(userStats.userId, userId));
      await tx.delete(outcomeLogs).where(eq(outcomeLogs.userId, userId));
      await tx.delete(activityLog).where(eq(activityLog.userId, userId));
      await tx.delete(generatedReports).where(eq(generatedReports.userId, userId));
      await tx.delete(weeklyReviews).where(eq(weeklyReviews.userId, userId));
      await tx.delete(twelveWeekTactics).where(eq(twelveWeekTactics.userId, userId));
      await tx.delete(weeklyTargets).where(eq(weeklyTargets.userId, userId));
      await tx.delete(twelveWeekGoals).where(eq(twelveWeekGoals.userId, userId));
      await tx.delete(twelveWeekYears).where(eq(twelveWeekYears.userId, userId));
      await tx.delete(outcomes).where(eq(outcomes.userId, userId));
      await tx.delete(tasks).where(eq(tasks.userId, userId));
      await tx.delete(pillars).where(eq(pillars.userId, userId));
      await tx.delete(userPreferences).where(eq(userPreferences.userId, userId));
    });

    // Re-seed default gamification data (skip check since we just deleted everything)
    await seedDefaultData(userId, true);

    return NextResponse.json({ success: true, message: "Factory reset completed and default data seeded" });
  } catch (error) {
    console.error("Error during factory reset:", error);
    return NextResponse.json(
      { error: "Failed to perform factory reset" },
      { status: 500 }
    );
  }
}
