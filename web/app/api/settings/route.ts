import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, userPreferences, users } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();

    let preferences = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, userId)
    });

    if (!preferences) {
      // Verify user exists before attempting insert
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { id: true },
      });
      if (!user) {
        return NextResponse.json({
          theme: "light",
          timeFormat: "12h",
          dateFormat: "DD/MM/YYYY",
        });
      }
      const [created] = await db.insert(userPreferences).values({
        userId,
        theme: "light",
        timeFormat: "12h",
        dateFormat: "DD/MM/YYYY",
      }).returning();
      preferences = created;
    }

    return NextResponse.json(preferences);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    const userId = await getAuthenticatedUserId();

    body = await request.json() as Record<string, unknown>;
    const { theme, timeFormat, dateFormat, streakThreshold, habitualColor, targetColor, outcomeColor, promoCode } = body as {
      theme?: string; timeFormat?: string; dateFormat?: string; streakThreshold?: number;
      habitualColor?: string; targetColor?: string; outcomeColor?: string; promoCode?: string;
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
      where: eq(userPreferences.userId, userId)
    });

    let preferences;
    if (existing) {
      const updateData: Record<string, unknown> = {};
      if (theme) updateData.theme = theme;
      if (timeFormat) updateData.timeFormat = timeFormat;
      if (dateFormat) updateData.dateFormat = dateFormat;
      if (streakThreshold !== undefined) {
        const val = Math.round(streakThreshold);
        if (val >= 1 && val <= 100) updateData.streakThreshold = val;
      }
      if (habitualColor) updateData.habitualColor = habitualColor;
      if (targetColor) updateData.targetColor = targetColor;
      if (outcomeColor) updateData.outcomeColor = outcomeColor;
      if (promoCode !== undefined) {
        if (typeof promoCode !== 'string' || promoCode.length > 50) {
          return NextResponse.json({ error: "Invalid promo code" }, { status: 400 });
        }
        const VALID_CODES = ['FREE123'];
        if (VALID_CODES.includes(promoCode.toUpperCase())) {
          updateData.isPremium = true;
          updateData.premiumActivatedAt = new Date();
          updateData.promoCode = promoCode.toUpperCase();
        } else {
          return NextResponse.json({ error: "Invalid promo code" }, { status: 400 });
        }
      }
      const [updated] = await db.update(userPreferences)
        .set(updateData)
        .where(eq(userPreferences.userId, userId))
        .returning();
      preferences = updated;
    } else {
      const [created] = await db.insert(userPreferences).values({
        userId,
        theme: theme || "light",
        timeFormat: timeFormat || "12h",
        dateFormat: dateFormat || "DD/MM/YYYY",
      }).returning();
      preferences = created;
    }

    return NextResponse.json(preferences);
  } catch (error) {
    return errorResponse(error);
  }
}
