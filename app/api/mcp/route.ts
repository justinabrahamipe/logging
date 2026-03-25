import { NextRequest } from "next/server";
import { db, locationLogs, tasks, goals, pillars, dailyScores, userPreferences, taskSchedules, activityLog } from "@/lib/db";
import { eq, and, desc, gte, lte, or, gt } from "drizzle-orm";
import { calculateTaskScore } from "@/lib/scoring";
import { saveDailyScore } from "@/lib/save-daily-score";
import { createAutoLog } from "@/lib/auto-log";
import { ensureUpcomingTasks, invalidateTaskCache } from "@/lib/ensure-upcoming-tasks";

const SERVER_INFO = {
  name: "grind-console",
  version: "1.0.0",
};

// Track active sessions: sessionId -> userId
const sessions = new Map<string, string>();

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
  {
    name: "complete_task",
    description: "Mark a task as complete or update its value. Use get_tasks first to find the task ID.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "number", description: "The task instance ID." },
        value: { type: "number", description: "The value to set (for numeric tasks). Omit for checkbox tasks." },
        completed: { type: "boolean", description: "Whether the task is completed. Defaults to true." },
      },
      required: ["taskId"],
    },
  },
  {
    name: "add_log",
    description: "Add a log entry (note/journal) for a given date.",
    inputSchema: {
      type: "object",
      properties: {
        notes: { type: "string", description: "The log text/notes." },
        date: { type: "string", description: "Date for the log (YYYY-MM-DD). Defaults to today." },
        time: { type: "string", description: "Time for the log (HH:MM). Defaults to current time." },
      },
      required: ["notes"],
    },
  },
  {
    name: "create_task",
    description: "Create a new task. Can be adhoc (one-time) or recurring (daily/weekly/custom).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Task name." },
        pillarId: { type: "number", description: "Pillar ID to group under (optional)." },
        completionType: { type: "string", description: "One of: checkbox, numeric, duration. Defaults to checkbox." },
        target: { type: "number", description: "Target value for numeric/duration tasks." },
        unit: { type: "string", description: "Unit label (e.g. 'minutes', 'pages')." },
        frequency: { type: "string", description: "One of: adhoc, daily, weekdays, weekends, custom. Defaults to adhoc." },
        customDays: { type: "string", description: "Comma-separated days (mon,tue,wed,...) for custom frequency." },
        basePoints: { type: "number", description: "Points for completing the task. Defaults to 10." },
        date: { type: "string", description: "Date for adhoc tasks (YYYY-MM-DD). Defaults to today." },
      },
      required: ["name"],
    },
  },
];

async function authenticate(request: NextRequest): Promise<string | null> {
  // Support Bearer token from Authorization header (used by Claude custom connectors)
  const authHeader = request.headers.get("authorization");
  const bearerKey = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  // Fall back to ?key= query param
  const key = bearerKey || request.nextUrl.searchParams.get("key");
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeTool(userId: string, name: string, args: Record<string, any>): Promise<string> {
  switch (name) {
    case "get_tasks": {
      const from = args.from || today();
      const to = args.to || today();
      const conditions = [eq(tasks.userId, userId), eq(tasks.dismissed, false), gte(tasks.date, from), lte(tasks.date, to)];
      const result = await db.select().from(tasks).where(and(...conditions)).orderBy(desc(tasks.date));
      const lines = result.map(t => {
        const status = t.completed ? "done" : "todo";
        const val = t.completionType !== "checkbox" && t.target ? `${t.value || 0}/${t.target}` : status;
        return `[${t.date}] (id:${t.id}) ${t.name} — ${val}`;
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
    case "complete_task": {
      const taskId = parseInt(args.taskId);
      if (!taskId) return "Error: taskId is required.";

      const [task] = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
      if (!task) return "Error: Task not found.";

      const completionValue = args.value != null ? parseFloat(args.value) : (task.completionType === 'checkbox' ? 1 : 0);
      const targetReached = task.target != null && task.target > 0 && completionValue >= task.target;
      const isCompleted = args.completed != null ? args.completed === "true" || args.completed === true : (
        task.completionType === 'checkbox' ? true : targetReached
      );

      const pointsEarned = calculateTaskScore(
        { id: task.id, pillarId: task.pillarId, completionType: task.completionType, target: task.target, basePoints: task.basePoints, flexibilityRule: task.flexibilityRule, limitValue: task.limitValue, minimumTarget: task.minimumTarget },
        { taskId: task.id, completed: isCompleted, value: completionValue }
      );

      const previousValue = task.value ?? null;
      const pointsBefore = task.pointsEarned ?? 0;

      await db.update(tasks).set({
        completed: isCompleted,
        value: completionValue,
        pointsEarned,
        completedAt: isCompleted ? new Date() : null,
        timerStartedAt: null,
        skipped: false,
      }).where(eq(tasks.id, taskId));

      // Activity log
      let action = 'complete';
      if (previousValue !== null) {
        if (completionValue > (previousValue ?? 0)) action = 'add';
        else if (completionValue < (previousValue ?? 0)) action = 'subtract';
        else action = 'adjust';
      }
      await db.insert(activityLog).values({
        userId, taskId: task.id, pillarId: task.pillarId, action,
        previousValue, newValue: completionValue,
        delta: completionValue - (previousValue ?? 0),
        pointsBefore, pointsAfter: pointsEarned,
        pointsDelta: pointsEarned - pointsBefore,
        source: 'manual',
      });

      // Auto-log
      if (isCompleted && !task.completed) {
        const valueStr = completionValue > 0 && task.completionType !== 'checkbox' ? ` (${completionValue}${task.unit ? ' ' + task.unit : ''})` : '';
        await createAutoLog(userId, `✅ ${task.name}${valueStr}`, task.date || today());
      }

      // Update linked goal
      if (task.goalId) {
        const [linkedGoal] = await db.select().from(goals).where(and(eq(goals.id, task.goalId), eq(goals.userId, userId)));
        if (linkedGoal) {
          let newTotal: number;
          if (linkedGoal.goalType === 'outcome') {
            newTotal = isCompleted && completionValue > 0 ? completionValue : linkedGoal.currentValue;
          } else {
            const allWithProgress = await db.select({ value: tasks.value }).from(tasks)
              .where(and(eq(tasks.goalId, task.goalId), or(eq(tasks.completed, true), gt(tasks.value, 0))));
            newTotal = allWithProgress.reduce((sum, t) => sum + (t.value ?? 0), 0);
          }
          await db.update(goals).set({ currentValue: newTotal }).where(eq(goals.id, linkedGoal.id));
        }
      }

      // Recalculate daily score
      const taskDate = task.date || today();
      if (taskDate) await saveDailyScore(userId, taskDate);

      const status = isCompleted ? "completed" : "updated";
      const valStr = task.completionType !== 'checkbox' ? ` (value: ${completionValue})` : '';
      return `Task "${task.name}" ${status}${valStr}. Points: ${pointsEarned}.`;
    }

    case "add_log": {
      const notes = args.notes;
      if (!notes) return "Error: notes is required.";

      const date = args.date || today();
      const now = new Date();
      const time = args.time || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      await db.insert(locationLogs).values({
        userId,
        latitude: 0,
        longitude: 0,
        date,
        time,
        notes,
      });

      return `Log added for ${date} at ${time}: "${notes}"`;
    }

    case "create_task": {
      const taskName = args.name;
      if (!taskName) return "Error: name is required.";

      const frequency = args.frequency || 'adhoc';
      const isRecurring = frequency !== 'adhoc';
      const completionType = args.completionType || 'checkbox';
      const basePoints = args.basePoints ? parseInt(args.basePoints) : 10;
      const target = args.target ? parseFloat(args.target) : null;
      const pillarId = args.pillarId ? parseInt(args.pillarId) : null;

      if (pillarId) {
        const [p] = await db.select().from(pillars).where(and(eq(pillars.id, pillarId), eq(pillars.userId, userId)));
        if (!p) return "Error: Pillar not found.";
      }

      if (isRecurring) {
        const [schedule] = await db.insert(taskSchedules).values({
          pillarId,
          userId,
          name: taskName,
          completionType,
          target,
          unit: args.unit || null,
          flexibilityRule: 'must_today',
          limitValue: null,
          frequency,
          customDays: args.customDays || null,
          repeatInterval: null,
          basePoints,
          goalId: null,
          periodId: null,
          startDate: null,
        }).returning();

        invalidateTaskCache(userId);
        await ensureUpcomingTasks(userId);
        await createAutoLog(userId, `➕ Task created: ${taskName}`);
        return `Recurring task "${taskName}" created (${frequency}). Schedule ID: ${schedule.id}.`;
      } else {
        const taskDate = args.date || today();
        const [task] = await db.insert(tasks).values({
          pillarId,
          userId,
          name: taskName,
          completionType,
          target,
          unit: args.unit || null,
          flexibilityRule: 'must_today',
          limitValue: null,
          basePoints,
          goalId: null,
          periodId: null,
          date: taskDate,
        }).returning();

        await createAutoLog(userId, `➕ Task created: ${taskName}`);
        return `Task "${taskName}" created for ${taskDate}. Task ID: ${task.id}.`;
      }
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
    const userId = await authenticate(request);
    const message = await request.json();

    // Handle initialization (no auth needed for handshake)
    if (message.method === "initialize") {
      const sessionId = crypto.randomUUID();
      // Store session -> userId mapping if authenticated
      if (userId) {
        sessions.set(sessionId, userId);
      }
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

    // Resolve userId: direct auth or from an existing session
    const sessionId = request.headers.get("mcp-session-id");
    const resolvedUserId = userId || (sessionId ? sessions.get(sessionId) : null);

    // All other methods need auth
    if (!resolvedUserId) {
      return jsonRpcError(message.id, -32000, "Invalid API key. Pass via Authorization: Bearer <key> header or ?key= query param.");
    }

    // Tool discovery
    if (message.method === "tools/list") {
      return jsonRpcResponse(message.id, { tools: TOOLS });
    }

    // Tool execution
    if (message.method === "tools/call") {
      const { name, arguments: args } = message.params;
      const result = await executeTool(resolvedUserId, name, args || {});
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

export async function DELETE(request: NextRequest) {
  // Session termination
  const sessionId = request.headers.get("mcp-session-id");
  if (sessionId) sessions.delete(sessionId);
  return new Response(null, { status: 202 });
}

export async function GET() {
  return new Response(null, { status: 405 });
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, x-api-key",
    },
  });
}
