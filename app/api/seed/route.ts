import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, pillars } from "@/lib/db";
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
