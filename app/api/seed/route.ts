import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, pillars, tasks, taskSchedules, goals, dailyScores, activityLog } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { seedDefaultData } from "@/lib/seed-data";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user already has pillars (count to avoid race conditions)
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(pillars)
    .where(eq(pillars.userId, session.user.id));

  if (count > 0) {
    return NextResponse.json({ message: "User already has data." }, { status: 200 });
  }

  await seedDefaultData(session.user.id);

  return NextResponse.json({ success: true, message: "Default data seeded successfully" });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Delete in order respecting foreign keys
  await db.delete(activityLog).where(eq(activityLog.userId, userId));
  await db.delete(dailyScores).where(eq(dailyScores.userId, userId));
  await db.delete(tasks).where(eq(tasks.userId, userId));
  await db.delete(taskSchedules).where(eq(taskSchedules.userId, userId));
  await db.delete(goals).where(eq(goals.userId, userId));
  await db.delete(pillars).where(eq(pillars.userId, userId));

  return NextResponse.json({ success: true, message: "All data cleared" });
}
