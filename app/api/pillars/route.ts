import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, pillars } from "@/lib/db";
import { eq } from "drizzle-orm";
import { createAutoLog } from "@/lib/auto-log";

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();

    const result = await db
      .select()
      .from(pillars)
      .where(eq(pillars.userId, userId));

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();

    const body = await request.json();
    const { name, emoji, color, weight, description } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Auto-calculate weight if not provided
    const existing = await db
      .select()
      .from(pillars)
      .where(eq(pillars.userId, userId));

    const calculatedWeight = weight ?? (existing.length > 0 ? Math.round(100 / (existing.length + 1)) : 100);

    const [pillar] = await db.insert(pillars).values({
      userId,
      name,
      emoji: emoji || '📌',
      color: color || '#3B82F6',
      weight: calculatedWeight,
      description: description || null,
    }).returning();

    await createAutoLog(userId, `📌 Pillar created: ${name}`);
    return NextResponse.json(pillar, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
