import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, pillars } from "@/lib/db";
import { eq, and, asc } from "drizzle-orm";

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();

    const result = await db
      .select()
      .from(pillars)
      .where(and(eq(pillars.userId, userId), eq(pillars.isArchived, false)))
      .orderBy(asc(pillars.sortOrder));

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

    // Get current max sortOrder
    const existing = await db
      .select()
      .from(pillars)
      .where(and(eq(pillars.userId, userId), eq(pillars.isArchived, false)));

    const maxSort = existing.reduce((max, p) => Math.max(max, p.sortOrder), -1);

    // Auto-calculate weight if not provided
    const calculatedWeight = weight ?? (existing.length > 0 ? Math.round(100 / (existing.length + 1)) : 100);

    const [pillar] = await db.insert(pillars).values({
      userId,
      name,
      emoji: emoji || '📌',
      color: color || '#3B82F6',
      weight: calculatedWeight,
      description: description || null,
      sortOrder: maxSort + 1,
    }).returning();

    return NextResponse.json(pillar, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
