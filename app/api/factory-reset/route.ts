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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeDelete(table: any, userId: string, userIdField: any) {
  try {
    await db.delete(table).where(eq(userIdField, userId));
  } catch (e) {
    // Table might not exist yet in prod — skip and continue
    console.warn(`Factory reset: skipping table delete`, e);
  }
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // Delete all user data (order matters due to FKs)
    // Using sequential deletes instead of transaction for Turso/libsql HTTP compatibility
    // Each wrapped in safeDelete to handle missing tables gracefully
    await safeDelete(taskCompletions, userId, taskCompletions.userId);
    await safeDelete(dailyScores, userId, dailyScores.userId);
    await safeDelete(userStats, userId, userStats.userId);
    await safeDelete(outcomeLogs, userId, outcomeLogs.userId);
    await safeDelete(activityLog, userId, activityLog.userId);
    await safeDelete(generatedReports, userId, generatedReports.userId);
    await safeDelete(weeklyReviews, userId, weeklyReviews.userId);
    await safeDelete(twelveWeekTactics, userId, twelveWeekTactics.userId);
    await safeDelete(weeklyTargets, userId, weeklyTargets.userId);
    await safeDelete(twelveWeekGoals, userId, twelveWeekGoals.userId);
    await safeDelete(twelveWeekYears, userId, twelveWeekYears.userId);
    await safeDelete(outcomes, userId, outcomes.userId);
    await safeDelete(tasks, userId, tasks.userId);
    await safeDelete(pillars, userId, pillars.userId);
    await safeDelete(userPreferences, userId, userPreferences.userId);

    // Re-seed default gamification data (skip check since we just deleted everything)
    await seedDefaultData(userId, true);

    return NextResponse.json({ success: true, message: "Factory reset completed and default data seeded" });
  } catch (error) {
    console.error("Error during factory reset:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to perform factory reset", details: message },
      { status: 500 }
    );
  }
}
