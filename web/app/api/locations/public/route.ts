import { NextRequest, NextResponse } from "next/server";
import { db, locationLogs, userPreferences, tasks, goals, pillars, dailyScores } from "@/lib/db";
import { eq, and, desc, like, gte, lte } from "drizzle-orm";
import crypto from "crypto";
import { rateLimit } from "@/lib/rate-limit";

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

async function authenticateApiKey(request: NextRequest): Promise<string | null> {
  const key = request.nextUrl.searchParams.get("key") || request.headers.get("x-api-key");
  if (!key) return null;

  // Try hashed lookup first, then fall back to plaintext for unmigrated keys
  const hashed = hashKey(key);
  const [byHash] = await db
    .select({ userId: userPreferences.userId })
    .from(userPreferences)
    .where(eq(userPreferences.apiKeyHash, hashed));
  if (byHash?.userId) return byHash.userId;

  const [byPlain] = await db
    .select({ userId: userPreferences.userId })
    .from(userPreferences)
    .where(eq(userPreferences.apiKey, key));
  if (byPlain?.userId) {
    // Migrate: store hash and clear plaintext
    await db.update(userPreferences)
      .set({ apiKeyHash: hashed, apiKey: null })
      .where(eq(userPreferences.userId, byPlain.userId));
    return byPlain.userId;
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    // Rate limit by IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit(`public:${ip}`, 60, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } });
    }

    const userId = await authenticateApiKey(request);
    if (!userId) {
      return NextResponse.json({ error: "API key required. Pass as ?key= or x-api-key header." }, { status: 401 });
    }

    const url = request.nextUrl;
    const section = url.searchParams.get("section") || "all";
    const format = url.searchParams.get("format") || "json";
    const search = url.searchParams.get("search");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const data: Record<string, unknown> = {};

    // Logs
    if (section === "all" || section === "logs") {
      const conditions = [eq(locationLogs.userId, userId)];
      if (from) conditions.push(gte(locationLogs.date, from));
      if (to) conditions.push(lte(locationLogs.date, to));
      if (search) {
        const sanitized = search.substring(0, 200).replace(/[%_]/g, '\\$&');
        conditions.push(like(locationLogs.notes, `%${sanitized}%`));
      }
      data.logs = await db.select().from(locationLogs).where(and(...conditions)).orderBy(desc(locationLogs.date), desc(locationLogs.createdAt));
    }

    // Tasks
    if (section === "all" || section === "tasks") {
      const conditions = [eq(tasks.userId, userId), eq(tasks.dismissed, false)];
      if (from) conditions.push(gte(tasks.date, from));
      if (to) conditions.push(lte(tasks.date, to));
      data.tasks = await db.select().from(tasks).where(and(...conditions)).orderBy(desc(tasks.date));
    }

    // Goals
    if (section === "all" || section === "goals") {
      data.goals = await db.select({
        id: goals.id, name: goals.name, goalType: goals.goalType, status: goals.status,
        startValue: goals.startValue, targetValue: goals.targetValue, currentValue: goals.currentValue,
        unit: goals.unit, startDate: goals.startDate, targetDate: goals.targetDate,
        completionType: goals.completionType, dailyTarget: goals.dailyTarget,
        pillarName: pillars.name,
      }).from(goals).leftJoin(pillars, eq(goals.pillarId, pillars.id)).where(eq(goals.userId, userId));
    }

    // Scores
    if (section === "all" || section === "scores") {
      const conditions = [eq(dailyScores.userId, userId)];
      if (from) conditions.push(gte(dailyScores.date, from));
      if (to) conditions.push(lte(dailyScores.date, to));
      data.scores = await db.select().from(dailyScores).where(and(...conditions)).orderBy(desc(dailyScores.date));
    }

    // Pillars
    if (section === "all" || section === "pillars") {
      data.pillars = await db.select().from(pillars).where(eq(pillars.userId, userId));
    }

    if (format === "text") {
      const lines: string[] = [];

      if (data.logs) {
        lines.push("=== LOGS ===");
        for (const log of data.logs as { date: string; latitude: number; longitude: number; notes: string | null }[]) {
          lines.push(`[${log.date}] ${log.notes || "(no notes)"} — ${log.latitude.toFixed(4)}, ${log.longitude.toFixed(4)}`);
        }
        lines.push("");
      }

      if (data.goals) {
        lines.push("=== GOALS ===");
        for (const g of data.goals as { name: string; goalType: string; status: string; currentValue: number; targetValue: number; unit: string; pillarName: string | null }[]) {
          lines.push(`[${g.status}] ${g.name} (${g.goalType}) — ${g.currentValue}/${g.targetValue} ${g.unit}${g.pillarName ? ` | ${g.pillarName}` : ""}`);
        }
        lines.push("");
      }

      if (data.tasks) {
        lines.push("=== TASKS ===");
        for (const t of data.tasks as { date: string; name: string; completed: boolean; value: number | null; target: number | null; completionType: string }[]) {
          const status = t.completed ? "done" : "todo";
          const val = t.completionType !== "checkbox" && t.target ? `${t.value || 0}/${t.target}` : status;
          lines.push(`[${t.date}] ${t.name} — ${val}`);
        }
        lines.push("");
      }

      if (data.scores) {
        lines.push("=== DAILY SCORES ===");
        for (const s of data.scores as { date: string; actionScore: number; momentumScore: number | null }[]) {
          lines.push(`[${s.date}] Action: ${s.actionScore}%${s.momentumScore != null ? ` | Momentum: ${s.momentumScore}` : ""}`);
        }
      }

      return new NextResponse(lines.join("\n"), {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*" },
      });
    }

    return NextResponse.json(data, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    console.error("Public API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "x-api-key, content-type",
    },
  });
}
