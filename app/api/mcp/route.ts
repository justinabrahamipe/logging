import { NextRequest } from "next/server";
import { db, userPreferences } from "@/lib/db";
import { eq } from "drizzle-orm";
import { handleGetTasks, handleGetGoals, handleGetScores, handleGetLogs, handleGetPillars, handleGetSummary, handleGetCycles, handleGetFeedback, handleGetTaskDetails } from "./handlers/read-handlers";
import { handleCompleteTask, handleCreateTask, handleEditTask, handleDeleteTask } from "./handlers/task-handlers";
import { handleCreateGoal, handleEditGoal } from "./handlers/goal-handlers";
import { handleCreatePillar, handleEditPillar, handleCreateCycle, handleEditCycle, handleAddLog } from "./handlers/pillar-handlers";

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
    description: "Get life pillars (categories) with their default base points and descriptions.",
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
        latitude: { type: "number", description: "Latitude (-90 to 90). Defaults to 0." },
        longitude: { type: "number", description: "Longitude (-180 to 180). Defaults to 0." },
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
        goalId: { type: "number", description: "Goal ID to link this task to (optional). Use get_goals to find the ID." },
        periodId: { type: "number", description: "Cycle/period ID to link to (optional)." },
        flexibilityRule: { type: "string", description: "One of: must_today, at_least, limit_avoid. Defaults to must_today." },
        limitValue: { type: "number", description: "Limit value for limit_avoid tasks (max allowed)." },
        date: { type: "string", description: "Date for adhoc tasks (YYYY-MM-DD). Omit for a no-date task that appears on today's view until completed." },
        description: { type: "string", description: "Optional description/notes for the task." },
      },
      required: ["name"],
    },
  },
  {
    name: "get_task_details",
    description: "Get full details of a specific task including schedule info, goal link, points, and completion state.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "number", description: "The task instance ID." },
      },
      required: ["taskId"],
    },
  },
  {
    name: "edit_task",
    description: "Edit an existing task's properties. Use get_tasks first to find the task ID.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "number", description: "The task instance ID to edit." },
        name: { type: "string", description: "New task name." },
        pillarId: { type: "number", description: "New pillar ID." },
        completionType: { type: "string", description: "One of: checkbox, numeric, duration." },
        target: { type: "number", description: "New target value." },
        unit: { type: "string", description: "New unit label." },
        basePoints: { type: "number", description: "New base points." },
        date: { type: "string", description: "New date (YYYY-MM-DD)." },
        goalId: { type: "number", description: "Goal ID to link to. Pass 0 to unlink." },
        periodId: { type: "number", description: "Cycle/period ID. Pass 0 to unlink." },
        flexibilityRule: { type: "string", description: "One of: must_today, at_least, limit_avoid." },
        limitValue: { type: "number", description: "Limit value for limit_avoid rule." },
        description: { type: "string", description: "New description/notes for the task." },
      },
      required: ["taskId"],
    },
  },
  {
    name: "create_goal",
    description: "Create a new goal. Types: outcome (track a measurable result), target (accumulate toward a number), habitual (build a daily habit).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Goal name." },
        goalType: { type: "string", description: "One of: outcome, target, habitual. Defaults to outcome." },
        targetValue: { type: "number", description: "Target value to reach (required for outcome/target goals)." },
        unit: { type: "string", description: "Unit of measurement (e.g. 'kg', 'pages', 'days'). Defaults to 'days'." },
        startValue: { type: "number", description: "Starting value. Defaults to 0." },
        pillarId: { type: "number", description: "Pillar ID to link to (optional)." },
        periodId: { type: "number", description: "Cycle/period ID to link to (optional). Use create_cycle first to get the ID." },
        startDate: { type: "string", description: "Start date (YYYY-MM-DD)." },
        targetDate: { type: "string", description: "Target/deadline date (YYYY-MM-DD)." },
        completionType: { type: "string", description: "One of: checkbox, count, numeric. Defaults to checkbox." },
        dailyTarget: { type: "number", description: "Per-session target for habitual/target goals." },
        autoCreateTasks: { type: "boolean", description: "Auto-create daily tasks for this goal. Defaults to false." },
        scheduleDays: { type: "array", items: { type: "number" }, description: "Days of week to schedule (0=Sun, 1=Mon, ..., 6=Sat)." },
        flexibilityRule: { type: "string", description: "One of: must_today, at_least, limit_avoid. Defaults to must_today." },
        limitValue: { type: "number", description: "Limit value for limit_avoid goals." },
      },
      required: ["name"],
    },
  },
  {
    name: "edit_goal",
    description: "Edit an existing goal's properties. Use get_goals first to find the goal ID.",
    inputSchema: {
      type: "object",
      properties: {
        goalId: { type: "number", description: "The goal ID to edit." },
        name: { type: "string", description: "New goal name." },
        pillarId: { type: "number", description: "New pillar ID." },
        startValue: { type: "number", description: "New start value." },
        targetValue: { type: "number", description: "New target value." },
        unit: { type: "string", description: "New unit." },
        startDate: { type: "string", description: "New start date (YYYY-MM-DD)." },
        targetDate: { type: "string", description: "New target date (YYYY-MM-DD)." },
        status: { type: "string", description: "One of: active, completed, abandoned." },
        periodId: { type: "number", description: "Cycle/period ID to link to. Pass 0 to unlink." },
        dailyTarget: { type: "number", description: "New per-session target." },
        completionType: { type: "string", description: "One of: checkbox, count, numeric." },
        goalType: { type: "string", description: "One of: outcome, target, habitual." },
        scheduleDays: { type: "array", items: { type: "number" }, description: "Days of week (0=Sun..6=Sat)." },
        autoCreateTasks: { type: "boolean", description: "Auto-create daily tasks." },
        flexibilityRule: { type: "string", description: "One of: must_today, at_least, limit_avoid." },
        limitValue: { type: "number", description: "Limit value for limit_avoid." },
      },
      required: ["goalId"],
    },
  },
  {
    name: "delete_task",
    description: "Delete a task. Goal-linked tasks are dismissed instead of deleted to prevent auto-recreation. Use get_tasks first to find the task ID.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "number", description: "The task ID to delete." },
      },
      required: ["taskId"],
    },
  },
  {
    name: "create_cycle",
    description: "Create a new cycle/period (e.g. monthly sprint). Goals can be linked to cycles via periodId.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Cycle name (e.g. 'April 2026')." },
        startDate: { type: "string", description: "Start date (YYYY-MM-DD)." },
        endDate: { type: "string", description: "End date (YYYY-MM-DD)." },
        vision: { type: "string", description: "Vision statement for this cycle (optional)." },
        theme: { type: "string", description: "Theme for this cycle (optional)." },
      },
      required: ["name", "startDate", "endDate"],
    },
  },
  {
    name: "create_pillar",
    description: "Create a new life pillar (category for grouping tasks and goals).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Pillar name (e.g. 'Health', 'Career')." },
        emoji: { type: "string", description: "Emoji icon. Defaults to '📌'." },
        color: { type: "string", description: "Hex color (e.g. '#3B82F6'). Defaults to blue." },
        defaultBasePoints: { type: "number", description: "Default base points for tasks in this pillar (default 10)." },
        description: { type: "string", description: "Description of this pillar (optional)." },
      },
      required: ["name"],
    },
  },
  {
    name: "edit_pillar",
    description: "Edit an existing pillar. Use get_pillars to find the ID.",
    inputSchema: {
      type: "object",
      properties: {
        pillarId: { type: "number", description: "The pillar ID to edit." },
        name: { type: "string", description: "New name." },
        emoji: { type: "string", description: "New emoji." },
        color: { type: "string", description: "New hex color." },
        defaultBasePoints: { type: "number", description: "Default base points for tasks in this pillar." },
        description: { type: "string", description: "New description." },
      },
      required: ["pillarId"],
    },
  },
  {
    name: "edit_cycle",
    description: "Edit an existing cycle/period. Use get_cycles to find the ID.",
    inputSchema: {
      type: "object",
      properties: {
        cycleId: { type: "number", description: "The cycle ID to edit." },
        name: { type: "string", description: "New name." },
        startDate: { type: "string", description: "New start date (YYYY-MM-DD)." },
        endDate: { type: "string", description: "New end date (YYYY-MM-DD)." },
        vision: { type: "string", description: "New vision statement." },
        theme: { type: "string", description: "New theme." },
      },
      required: ["cycleId"],
    },
  },
  {
    name: "get_cycles",
    description: "Get all cycles/periods with their dates, vision, and theme.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_feedback",
    description: "Get feedback/contact messages submitted by the user.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter by status: todo, in_progress, done. Returns all if omitted." },
      },
    },
  },
];

async function authenticate(request: NextRequest): Promise<string | null> {
  // Support Bearer token from Authorization header (used by custom connectors)
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeTool(userId: string, name: string, args: Record<string, any>): Promise<string> {
  switch (name) {
    case "get_tasks": return handleGetTasks(args, userId);
    case "get_goals": return handleGetGoals(args, userId);
    case "get_scores": return handleGetScores(args, userId);
    case "get_logs": return handleGetLogs(args, userId);
    case "get_pillars": return handleGetPillars(args, userId);
    case "get_summary": return handleGetSummary(userId);
    case "get_cycles": return handleGetCycles(args, userId);
    case "get_feedback": return handleGetFeedback(args, userId);
    case "get_task_details": return handleGetTaskDetails(args, userId);
    case "complete_task": return handleCompleteTask(args, userId);
    case "create_task": return handleCreateTask(args, userId);
    case "edit_task": return handleEditTask(args, userId);
    case "delete_task": return handleDeleteTask(args, userId);
    case "create_goal": return handleCreateGoal(args, userId);
    case "edit_goal": return handleEditGoal(args, userId);
    case "create_pillar": return handleCreatePillar(args, userId);
    case "edit_pillar": return handleEditPillar(args, userId);
    case "create_cycle": return handleCreateCycle(args, userId);
    case "edit_cycle": return handleEditCycle(args, userId);
    case "add_log": return handleAddLog(args, userId);
    default: return `Unknown tool: ${name}`;
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
