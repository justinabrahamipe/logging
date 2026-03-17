import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createClient } from "@libsql/client";
import { seedDefaultData } from "@/lib/seed-data";

// Tables to delete in FK-safe order (children before parents)
const TABLES_TO_DELETE = [
  "TaskCompletion",
  "DailyScore",
  "ActivityLog",
  "Cycle",
  "Goal",
  "Task",
  "TaskSchedule",
  "Pillar",
  "UserPreferences",
];

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await request.json().catch(() => ({}));
  const seedDefaults = body.seedDefaults !== false; // default true for backward compat

  try {
    // Use raw SQL client to bypass any Drizzle schema mismatches
    const client = createClient({
      url: process.env.DATABASE_URL!,
      authToken: process.env.DATABASE_AUTH_TOKEN!,
    });

    // Disable foreign key checks to avoid FK ordering issues
    await client.execute("PRAGMA foreign_keys = OFF");

    const deleted: string[] = [];
    const skipped: string[] = [];

    for (const table of TABLES_TO_DELETE) {
      try {
        await client.execute({
          sql: `DELETE FROM "${table}" WHERE "userId" = ?`,
          args: [userId],
        });
        deleted.push(table);
      } catch (e) {
        // Table might not exist in production — skip
        skipped.push(table);
        console.warn(`Factory reset: skipped ${table}`, e);
      }
    }

    // Re-enable foreign key checks
    await client.execute("PRAGMA foreign_keys = ON");

    // Re-seed default data only if requested
    if (seedDefaults) {
      await seedDefaultData(userId, true);
    }

    return NextResponse.json({
      success: true,
      message: seedDefaults
        ? "Factory reset completed and default data seeded"
        : "All data cleared successfully",
      deleted,
      skipped,
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
