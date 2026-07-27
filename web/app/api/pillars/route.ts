import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, pillars } from "@/lib/db";
import { eq } from "drizzle-orm";
import { createAutoLog } from "@/lib/auto-log";
import { pillarCreateSchema } from "@/lib/schemas/pillar";

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
    const result = pillarCreateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid input", details: result.error.issues }, { status: 400 });
    }
    const { name, emoji, color, defaultBasePoints, description } = result.data;

    const [pillar] = await db.insert(pillars).values({
      userId,
      name,
      emoji: emoji || '📌',
      color: color || '#3B82F6',
      defaultBasePoints: defaultBasePoints ?? 10,
      description: description || null,
    }).returning();

    await createAutoLog(userId, `📌 Pillar created: ${name}`);
    return NextResponse.json(pillar, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
