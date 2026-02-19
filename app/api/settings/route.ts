import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, userPreferences } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let preferences = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, session.user.id)
    });

    if (!preferences) {
      const [created] = await db.insert(userPreferences).values({
        userId: session.user.id,
        theme: "light",
        timeFormat: "12h",
        dateFormat: "DD/MM/YYYY",
        weekdayPassThreshold: 70,
        weekendPassThreshold: 70,
      }).returning();
      preferences = created;
    }

    return NextResponse.json(preferences);
  } catch (error) {
    console.error("Error fetching preferences:", error);
    return NextResponse.json({
      theme: "light",
      timeFormat: "12h",
      dateFormat: "DD/MM/YYYY",
      weekdayPassThreshold: 70,
      weekendPassThreshold: 70,
    });
  }
}

export async function PUT(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    body = await request.json() as Record<string, unknown>;
    const { theme, timeFormat, dateFormat, weekdayPassThreshold, weekendPassThreshold } = body as {
      theme?: string; timeFormat?: string; dateFormat?: string; weekdayPassThreshold?: number; weekendPassThreshold?: number;
    };

    const validThemes = ["light", "dark", "system"];
    const validTimeFormats = ["12h", "24h"];
    const validDateFormats = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD-MM-YYYY", "MM-DD-YYYY"];

    if (theme && !validThemes.includes(theme)) {
      return NextResponse.json({ error: "Invalid theme value" }, { status: 400 });
    }
    if (timeFormat && !validTimeFormats.includes(timeFormat)) {
      return NextResponse.json({ error: "Invalid timeFormat value" }, { status: 400 });
    }
    if (dateFormat && !validDateFormats.includes(dateFormat)) {
      return NextResponse.json({ error: "Invalid dateFormat value" }, { status: 400 });
    }

    const existing = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, session.user.id)
    });

    let preferences;
    if (existing) {
      const updateData: Record<string, unknown> = {};
      if (theme) updateData.theme = theme;
      if (timeFormat) updateData.timeFormat = timeFormat;
      if (dateFormat) updateData.dateFormat = dateFormat;
      if (typeof weekdayPassThreshold === "number") updateData.weekdayPassThreshold = weekdayPassThreshold;
      if (typeof weekendPassThreshold === "number") updateData.weekendPassThreshold = weekendPassThreshold;

      const [updated] = await db.update(userPreferences)
        .set(updateData)
        .where(eq(userPreferences.userId, session.user.id))
        .returning();
      preferences = updated;
    } else {
      const [created] = await db.insert(userPreferences).values({
        userId: session.user.id,
        theme: theme || "light",
        timeFormat: timeFormat || "12h",
        dateFormat: dateFormat || "DD/MM/YYYY",
        weekdayPassThreshold: weekdayPassThreshold ?? 70,
        weekendPassThreshold: weekendPassThreshold ?? 70,
      }).returning();
      preferences = created;
    }

    return NextResponse.json(preferences);
  } catch (error) {
    console.error("Error updating preferences:", error);
    return NextResponse.json({
      theme: body.theme || "light",
      timeFormat: body.timeFormat || "12h",
      dateFormat: body.dateFormat || "DD/MM/YYYY",
      weekdayPassThreshold: body.weekdayPassThreshold ?? 70,
      weekendPassThreshold: body.weekendPassThreshold ?? 70,
    });
  }
}
