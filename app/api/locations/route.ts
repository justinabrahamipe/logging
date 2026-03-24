import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, locationLogs } from "@/lib/db";
import { eq, and, desc, asc, like, gte, lte } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    const url = request.nextUrl;
    const search = url.searchParams.get("search");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const sort = url.searchParams.get("sort") || "desc";

    const conditions = [eq(locationLogs.userId, userId)];
    if (from) conditions.push(gte(locationLogs.date, from));
    if (to) conditions.push(lte(locationLogs.date, to));
    if (search) {
      conditions.push(like(locationLogs.notes, `%${search}%`));
    }

    const results = await db
      .select()
      .from(locationLogs)
      .where(and(...conditions))
      .orderBy(sort === "asc" ? asc(locationLogs.date) : desc(locationLogs.date), sort === "asc" ? asc(locationLogs.createdAt) : desc(locationLogs.createdAt));

    return NextResponse.json(results);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    const body = await request.json();
    const { latitude, longitude, date, notes } = body;

    if (latitude == null || longitude == null || !date) {
      return NextResponse.json({ error: "latitude, longitude, and date are required" }, { status: 400 });
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
    }

    const [result] = await db
      .insert(locationLogs)
      .values({ userId, latitude, longitude, date, notes: notes || null })
      .returning();

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
