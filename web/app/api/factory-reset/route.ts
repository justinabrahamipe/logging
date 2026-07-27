import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, pillars, taskSchedules, tasks, goals, cycles, dailyScores, activityLog, userPreferences } from "@/lib/db";
import { eq } from "drizzle-orm";
import { seedDefaultData } from "@/lib/seed-data";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Strict rate limit on destructive endpoint: 3 per hour
  const rl = rateLimit(`reset:${session.user.id}`, 3, 3600_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });
  }

  const userId = session.user.id;
  const body = await request.json().catch(() => ({}));
  const seedDefaults = body.seedDefaults !== false;

  try {
    // Delete in FK-safe order (children before parents) using Drizzle
    await db.delete(activityLog).where(eq(activityLog.userId, userId));
    await db.delete(dailyScores).where(eq(dailyScores.userId, userId));
    await db.delete(tasks).where(eq(tasks.userId, userId));
    await db.delete(taskSchedules).where(eq(taskSchedules.userId, userId));
    await db.delete(goals).where(eq(goals.userId, userId));
    await db.delete(cycles).where(eq(cycles.userId, userId));
    await db.delete(pillars).where(eq(pillars.userId, userId));
    await db.delete(userPreferences).where(eq(userPreferences.userId, userId));

    // Re-seed default data only if requested
    if (seedDefaults) {
      await seedDefaultData(userId, true);
    }

    return NextResponse.json({
      success: true,
      message: seedDefaults
        ? "Factory reset completed and default data seeded"
        : "All data cleared successfully",
    });
  } catch (error) {
    console.error("Error during factory reset:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to perform factory reset", details: message },
      { status: 500 }
    );
  }
}
