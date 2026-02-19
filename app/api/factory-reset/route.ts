import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, pillars, tasks, taskCompletions, dailyScores, userStats } from "@/lib/db";
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
      // Delete gamification data (order matters due to FKs)
      await tx.delete(taskCompletions).where(eq(taskCompletions.userId, userId));
      await tx.delete(dailyScores).where(eq(dailyScores.userId, userId));
      await tx.delete(userStats).where(eq(userStats.userId, userId));
      await tx.delete(tasks).where(eq(tasks.userId, userId));
      await tx.delete(pillars).where(eq(pillars.userId, userId));
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
