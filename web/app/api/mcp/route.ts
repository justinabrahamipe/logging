import { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { resolveUserIdFromApiKey } from "@/lib/api-key-auth";
import { handleGetTasks, handleGetGoals, handleGetScores, handleGetLogs, handleGetPillars, handleGetSummary, handleGetCycles, handleGetFeedback, handleGetTaskDetails } from "./handlers/read-handlers";
import { handleCompleteTask, handleCreateTask, handleEditTask, handleDeleteTask } from "./handlers/task-handlers";
import { handleCreateGoal, handleEditGoal } from "./handlers/goal-handlers";
import { handleCreatePillar, handleEditPillar, handleCreateCycle, handleEditCycle, handleAddLog } from "./handlers/pillar-handlers";
import { z } from "zod";
import { goalCreateMcpSchema, goalEditMcpSchema } from "@/lib/schemas/goal";
import { taskCreateSchema, taskEditMcpSchema, taskCompleteMcpSchema, taskDeleteMcpSchema } from "@/lib/schemas/task";
import { pillarCreateSchema, pillarEditMcpSchema } from "@/lib/schemas/pillar";
import { cycleCreateSchema, cycleEditMcpSchema } from "@/lib/schemas/cycle";
import { addLogMcpSchema } from "@/lib/schemas/log";

// Convert a zod schema to the MCP tool inputSchema (JSON Schema). Wraps z.toJSONSchema
// so future schema additions get reflected in tool definitions automatically.
// Cleans up zod 4's defaults that confuse some MCP clients:
//  - drops $schema header
//  - drops `additionalProperties: false` (clients may add wrapper/meta fields)
//  - drops the SAFE_INTEGER min/max bounds zod adds to z.number().int()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cleanJsonSchema = (node: any): any => {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map(cleanJsonSchema);
  // Drop noisy fields
  if ("$schema" in node) delete node.$schema;
  if (node.additionalProperties === false) delete node.additionalProperties;
  if (node.type === "integer" && node.minimum === -9007199254740991) delete node.minimum;
  if (node.type === "integer" && node.maximum === 9007199254740991) delete node.maximum;
  // Recurse into nested schemas
  for (const k of Object.keys(node)) {
    if (typeof node[k] === "object") node[k] = cleanJsonSchema(node[k]);
  }
  return node;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toInputSchema = (schema: z.ZodType): any => {
  return cleanJsonSchema(z.toJSONSchema(schema, { target: "draft-7" }));
};

const SERVER_INFO = {
  name: "grind-console",
  version: "1.0.0",
};

// Track active sessions: sessionId -> userId
const sessions = new Map<string, string>();

const READ_ANNOTATION = { readOnlyHint: true, destructiveHint: false, idempotentHint: true };
const WRITE_ANNOTATION = { readOnlyHint: false, destructiveHint: false, idempotentHint: false };
const DESTRUCTIVE_ANNOTATION = { readOnlyHint: false, destructiveHint: true, idempotentHint: false };

const TOOLS = [
  // --- Read-only tools ---
  {
    name: "get_tasks",
    description: "Get tasks for a date range. Returns task name, completion status, value, target, and date.",
    annotations: READ_ANNOTATION,
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
    annotations: READ_ANNOTATION,
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_scores",
    description: "Get daily action scores and momentum for a date range.",
    annotations: READ_ANNOTATION,
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
    annotations: READ_ANNOTATION,
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
    annotations: READ_ANNOTATION,
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_summary",
    description: "Get a comprehensive summary of today's tasks, active goals, recent scores, and recent logs.",
    annotations: READ_ANNOTATION,
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_task_details",
    description: "Get full details of a specific task including schedule info, goal link, points, and completion state.",
    annotations: READ_ANNOTATION,
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "number", description: "The task instance ID." },
      },
      required: ["taskId"],
    },
  },
  {
    name: "get_cycles",
    description: "Get all cycles/periods with their dates, vision, and theme.",
    annotations: READ_ANNOTATION,
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_feedback",
    description: "Get feedback/contact messages submitted by the user.",
    annotations: READ_ANNOTATION,
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter by status: todo, in_progress, done. Returns all if omitted." },
      },
    },
  },
  // --- Write tools ---
  {
    name: "complete_task",
    description: "Mark a task as complete or update its value. Use get_tasks first to find the task ID.",
    annotations: WRITE_ANNOTATION,
    inputSchema: toInputSchema(taskCompleteMcpSchema),
  },
  {
    name: "add_log",
    description: "Add a log entry (note/journal) for a given date.",
    annotations: WRITE_ANNOTATION,
    inputSchema: toInputSchema(addLogMcpSchema),
  },
  {
    name: "create_task",
    description: "Create a new task. Can be adhoc (one-time) or recurring (daily/weekly/custom). When goalId is provided, inherits the goal's start date, pillar, and period automatically. Field shapes derived from lib/schemas/task.ts.",
    annotations: WRITE_ANNOTATION,
    inputSchema: toInputSchema(taskCreateSchema),
  },
  {
    name: "edit_task",
    description: "Edit an existing task's properties. Use get_tasks first to find the task ID. Field shapes derived from lib/schemas/task.ts.",
    annotations: WRITE_ANNOTATION,
    inputSchema: toInputSchema(taskEditMcpSchema),
  },
  {
    name: "create_goal",
    description: "Create a new goal. Field shapes (including the project type) are derived from lib/schemas/goal.ts — see goalType description for the four supported types.",
    annotations: WRITE_ANNOTATION,
    inputSchema: toInputSchema(goalCreateMcpSchema),
  },
  {
    name: "edit_goal",
    description: "Edit an existing goal's properties. Use get_goals first to find the goal ID. Field shapes derived from lib/schemas/goal.ts.",
    annotations: WRITE_ANNOTATION,
    inputSchema: toInputSchema(goalEditMcpSchema),
  },
  {
    name: "create_cycle",
    description: "Create a new cycle/period. Field shapes derived from lib/schemas/cycle.ts.",
    annotations: WRITE_ANNOTATION,
    inputSchema: toInputSchema(cycleCreateSchema),
  },
  {
    name: "create_pillar",
    description: "Create a new life pillar. Field shapes derived from lib/schemas/pillar.ts.",
    annotations: WRITE_ANNOTATION,
    inputSchema: toInputSchema(pillarCreateSchema),
  },
  {
    name: "edit_pillar",
    description: "Edit an existing pillar. Use get_pillars to find the ID.",
    annotations: WRITE_ANNOTATION,
    inputSchema: toInputSchema(pillarEditMcpSchema),
  },
  {
    name: "edit_cycle",
    description: "Edit an existing cycle/period. Use get_cycles to find the ID.",
    annotations: WRITE_ANNOTATION,
    inputSchema: toInputSchema(cycleEditMcpSchema),
  },
  // --- Destructive tools ---
  {
    name: "delete_task",
    description: "Delete a task. Goal-linked tasks are dismissed instead of deleted to prevent auto-recreation.",
    annotations: DESTRUCTIVE_ANNOTATION,
    inputSchema: toInputSchema(taskDeleteMcpSchema),
  },
];

async function authenticate(request: NextRequest): Promise<string | null> {
  // Support Bearer token from Authorization header (used by custom connectors)
  const authHeader = request.headers.get("authorization");
  const bearerKey = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  // Fall back to ?key= query param
  const key = bearerKey || request.nextUrl.searchParams.get("key");
  if (!key) return null;

  return resolveUserIdFromApiKey(key);
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
    // Rate limit by IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit(`mcp:${ip}`, 120, 60_000);
    if (!rl.allowed) {
      return jsonRpcError(null, -32000, "Rate limit exceeded. Try again later.");
    }

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
  // MCP Streamable HTTP transport: clients open a GET stream for server-initiated messages.
  // We don't push any (all messages are client-initiated POST), but returning 405 here
  // makes some connectors (Claude.ai) flash "couldn't reach the MCP server" on connect.
  // Respond with a valid empty SSE stream that closes immediately so the handshake stays clean.
  const stream = new ReadableStream({
    start(controller) {
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
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
