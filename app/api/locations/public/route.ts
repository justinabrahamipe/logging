import { NextRequest, NextResponse } from "next/server";
import { db, locationLogs, userPreferences } from "@/lib/db";
import { eq, and, desc, asc, like, gte, lte } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl;
    const key = url.searchParams.get("key") || request.headers.get("x-api-key");

    if (!key) {
      return NextResponse.json({ error: "API key required. Pass as ?key= or x-api-key header." }, { status: 401 });
    }

    // Look up user by API key
    const [pref] = await db
      .select({ userId: userPreferences.userId })
      .from(userPreferences)
      .where(eq(userPreferences.apiKey, key));

    if (!pref) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    const userId = pref.userId;
    const search = url.searchParams.get("search");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const sort = url.searchParams.get("sort") || "desc";
    const format = url.searchParams.get("format") || "json";

    const conditions = [eq(locationLogs.userId, userId)];
    if (from) conditions.push(gte(locationLogs.date, from));
    if (to) conditions.push(lte(locationLogs.date, to));
    if (search) conditions.push(like(locationLogs.notes, `%${search}%`));

    const results = await db
      .select()
      .from(locationLogs)
      .where(and(...conditions))
      .orderBy(sort === "asc" ? asc(locationLogs.date) : desc(locationLogs.date), sort === "asc" ? asc(locationLogs.createdAt) : desc(locationLogs.createdAt));

    if (format === "text") {
      const lines: string[] = [];
      let currentDate = "";
      for (const log of results) {
        if (log.date !== currentDate) {
          if (lines.length > 0) lines.push("");
          lines.push(`--- ${log.date} ---`);
          currentDate = log.date;
        }
        const coords = `${log.latitude.toFixed(6)}, ${log.longitude.toFixed(6)}`;
        lines.push(`  Location: ${coords}`);
        lines.push(`  Map: https://www.google.com/maps?q=${log.latitude},${log.longitude}`);
        if (log.notes) lines.push(`  Notes: ${log.notes}`);
      }
      return new NextResponse(lines.join("\n"), {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Public locations API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
