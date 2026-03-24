import { NextRequest } from "next/server";
import { db, locationLogs, tasks, goals, pillars, dailyScores, userPreferences } from "@/lib/db";
import { eq, and, desc, gte, lte } from "drizzle-orm";

const SERVER_INFO = {
  name: "grind-console",
  version: "1.0.0",
};

const TOOLS = [
  {
    name: "get_tasks",
    description: "Get tasks for a date range. Returns task name, completion status, value, target, and date.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Start date (YYYY-MM-DD). Defaults to today." },
        to: { type: "string", description: "End date (YYYY-MM-DD). Defaults to today." },
      },
    },
  },
  {
    name: "get_goals",
    description: "Get all goals with their progress, type (habitual/target/outcome), status, and linked pillar.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_scores",
    description: "Get daily action scores and momentum for a date range.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Start date (YYYY-MM-DD). Defaults to 7 days ago." },
        to: { type: "string", description: "End date (YYYY-MM-DD). Defaults to today." },
      },
    },
  },
  {
    name: "get_logs",
    description: "Get log entries (user notes, auto-logged task completions, goal changes, etc.) for a date range.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Start date (YYYY-MM-DD). Defaults to 7 days ago." },
        to: { type: "string", description: "End date (YYYY-MM-DD). Defaults to today." },
      },
    },
  },
  {
    name: "get_pillars",
    description: "Get life pillars (categories) with their weights and descriptions.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_summary",
    description: "Get a comprehensive summary of today's tasks, active goals, recent scores, and recent logs.",
    inputSchema: { type: "object", properties: {} },
  },
];

async function authenticateFromUrl(request: NextRequest): Promise<string | null> {
  const key = request.nextUrl.searchParams.get("key");
  if (!key) return null;
  const [pref] = await db
    .select({ userId: userPreferences.userId })
    .from(userPreferences)
    .where(eq(userPreferences.apiKey, key));
  return pref?.userId || null;
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

async function executeTool(userId: string, name: string, args: Record<string, string>): Promise<string> {
  switch (name) {
    case "get_tasks": {
      const from = args.from || today();
      const to = args.to || today();
      const conditions = [eq(tasks.userId, userId), eq(tasks.dismissed, false), gte(tasks.date, from), lte(tasks.date, to)];
      const result = await db.select().from(tasks).where(and(...conditions)).orderBy(desc(tasks.date));
      const lines = result.map(t => {
        const status = t.completed ? "done" : "todo";
        const val = t.completionType !== "checkbox" && t.target ? `${t.value || 0}/${t.target}` : status;
        return `[${t.date}] ${t.name} — ${val}`;
      });
      return lines.join("\n") || "No tasks found for this period.";
    }
    case "get_goals": {
      const result = await db.select({
        id: goals.id, name: goals.name, goalType: goals.goalType, status: goals.status,
        startValue: goals.startValue, targetValue: goals.targetValue, currentValue: goals.currentValue,
        unit: goals.unit, startDate: goals.startDate, targetDate: goals.targetDate,
        pillarName: pillars.name,
      }).from(goals).leftJoin(pillars, eq(goals.pillarId, pillars.id)).where(eq(goals.userId, userId));
      const lines = result.map(g =>
        `[${g.status}] ${g.name} (${g.goalType}) — ${g.currentValue}/${g.targetValue} ${g.unit}${g.pillarName ? ` | ${g.pillarName}` : ""}${g.startDate ? ` | ${g.startDate} to ${g.targetDate}` : ""}`
      );
      return lines.join("\n") || "No goals found.";
    }
    case "get_scores": {
      const from = args.from || daysAgo(7);
      const to = args.to || today();
      const result = await db.select().from(dailyScores).where(and(eq(dailyScores.userId, userId), gte(dailyScores.date, from), lte(dailyScores.date, to))).orderBy(desc(dailyScores.date));
      const lines = result.map(s => `[${s.date}] Action: ${s.actionScore}%${s.momentumScore != null ? ` | Momentum: ${s.momentumScore}` : ""}`);
      return lines.join("\n") || "No scores found for this period.";
    }
    case "get_logs": {
      const from = args.from || daysAgo(7);
      const to = args.to || today();
      const result = await db.select().from(locationLogs).where(and(eq(locationLogs.userId, userId), gte(locationLogs.date, from), lte(locationLogs.date, to))).orderBy(desc(locationLogs.date), desc(locationLogs.createdAt));
      const lines = result.map(l => `[${l.date}${l.time ? " " + l.time : ""}] ${l.notes || "(no notes)"}`);
      return lines.join("\n") || "No log entries found for this period.";
    }
    case "get_pillars": {
      const result = await db.select().from(pillars).where(eq(pillars.userId, userId));
      const lines = result.map(p => `${p.emoji} ${p.name} (weight: ${p.weight})${p.description ? ` — ${p.description}` : ""}`);
      return lines.join("\n") || "No pillars found.";
    }
    case "get_summary": {
      const [taskLines, goalLines, scoreLines, logLines] = await Promise.all([
        executeTool(userId, "get_tasks", { from: today(), to: today() }),
        executeTool(userId, "get_goals", {}),
        executeTool(userId, "get_scores", { from: daysAgo(7), to: today() }),
        executeTool(userId, "get_logs", { from: daysAgo(3), to: today() }),
      ]);
      return `=== TODAY'S TASKS ===\n${taskLines}\n\n=== GOALS ===\n${goalLines}\n\n=== SCORES (LAST 7 DAYS) ===\n${scoreLines}\n\n=== RECENT LOGS ===\n${logLines}`;
    }
    default:
      return `Unknown tool: ${name}`;
  }
}

function jsonRpcResponse(id: number | string, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result }, {
    headers: { "Content-Type": "application/json" },
  });
}

function jsonRpcError(id: number | string | null, code: number, message: string) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } }, {
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: NextRequest) {
  try {
    const userId = await authenticateFromUrl(request);
    const message = await request.json();

    // Handle initialization (no auth needed for handshake)
    if (message.method === "initialize") {
      const sessionId = crypto.randomUUID();
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: message.id,
        result: {
          protocolVersion: "2025-06-18",
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        },
      }), {
        headers: {
          "Content-Type": "application/json",
          "Mcp-Session-Id": sessionId,
        },
      });
    }

    // Handle initialized notification
    if (message.method === "notifications/initialized") {
      return new Response(null, { status: 202 });
    }

    // All other methods need auth
    if (!userId) {
      return jsonRpcError(message.id, -32000, "Invalid API key. Add ?key=YOUR_KEY to the MCP server URL.");
    }

    // Tool discovery
    if (message.method === "tools/list") {
      return jsonRpcResponse(message.id, { tools: TOOLS });
    }

    // Tool execution
    if (message.method === "tools/call") {
      const { name, arguments: args } = message.params;
      const result = await executeTool(userId, name, args || {});
      return jsonRpcResponse(message.id, {
        content: [{ type: "text", text: result }],
      });
    }

    // Ping
    if (message.method === "ping") {
      return jsonRpcResponse(message.id, {});
    }

    return jsonRpcError(message.id, -32601, `Method not found: ${message.method}`);
  } catch (error) {
    console.error("MCP error:", error);
    return jsonRpcError(null, -32603, "Internal error");
  }
}

export async function GET() {
  return new Response(null, { status: 405 });
}

export async function DELETE() {
  return new Response(null, { status: 202 });
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Mcp-Session-Id, x-api-key",
    },
  });
}
