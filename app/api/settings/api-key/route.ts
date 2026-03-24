import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, userPreferences } from "@/lib/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

// Generate a new API key
export async function POST() {
  try {
    const userId = await getAuthenticatedUserId();
    const key = `loc_${crypto.randomBytes(24).toString("hex")}`;

    const existing = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, userId),
    });

    if (existing) {
      await db.update(userPreferences).set({ apiKey: key, updatedAt: new Date() }).where(eq(userPreferences.userId, userId));
    } else {
      await db.insert(userPreferences).values({ userId, apiKey: key });
    }

    return NextResponse.json({ apiKey: key });
  } catch (error) {
    return errorResponse(error);
  }
}

// Revoke API key
export async function DELETE() {
  try {
    const userId = await getAuthenticatedUserId();

    await db.update(userPreferences).set({ apiKey: null, updatedAt: new Date() }).where(eq(userPreferences.userId, userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
