// Single source of truth for goal field shapes.
// Used by REST handlers, MCP tool input schemas, and field-mapping helpers.
// Adding a new field/enum value here propagates to all of them.

import { z } from "zod";
import { numField, nullableNumField, intField, strField, nullableStrField } from "./common";

export const GOAL_TYPES = ["outcome", "target", "habitual", "project"] as const;
export const COMPLETION_TYPES = ["checkbox", "count", "numeric", "duration"] as const;
export const FLEXIBILITY_RULES = ["must_today", "at_least", "limit_avoid"] as const;
export const GOAL_STATUSES = ["active", "completed", "abandoned"] as const;

// Common editable fields. All optional here so the same shape can serve
// create (with name made required) and edit (everything optional).
const goalFields = {
  name: strField().describe("Goal name."),
  pillarId: intField().describe("Pillar ID to link to. Pass 0 or null to unlink."),
  startValue: numField().describe("Baseline reference point, NOT current progress. For count-up goals (apps sent, books read, pages written) this is almost always 0 — do not set it to the user's current progress. Only set a non-zero value for metrics tracked from a non-zero baseline (e.g. current weight when tracking weight loss). Defaults to 0."),
  targetValue: numField().describe("Target value to reach. Required for outcome/target goals; project goals start at 0 and grow as subtasks are added."),
  unit: strField().describe("Unit of measurement (e.g. 'kg', 'pages'). Project goals default to 'steps'."),
  startDate: nullableStrField().describe("Start date (YYYY-MM-DD)."),
  targetDate: nullableStrField().describe("Target/deadline date (YYYY-MM-DD)."),
  periodId: intField().describe("Cycle/period ID to link to. Pass 0 or null to unlink."),
  goalType: z.enum(GOAL_TYPES).optional().describe(
    "outcome = track a metric over time (lose weight). " +
    "target = reach a numeric target by a deadline (read 50 pages). " +
    "habitual = recurring scheduled behaviour (gym 3x/week). " +
    "project = a fixed checklist of one-off subtasks (Surrender passport); progress ticks up automatically as linked tasks are completed and the goal auto-completes when all subtasks are done."
  ),
  completionType: z.enum(COMPLETION_TYPES).optional().describe("How individual sessions are tracked."),
  dailyTarget: nullableNumField().describe("Per-session target for habitual/target goals."),
  scheduleDays: z.array(z.number().int().min(0).max(6)).nullable().optional().describe("Days of week to schedule (0=Sun..6=Sat). Not used by project goals."),
  autoCreateTasks: z.boolean().optional().describe("Auto-create daily tasks for this goal. Not used by project goals."),
  flexibilityRule: z.enum(FLEXIBILITY_RULES).optional().describe("must_today | at_least | limit_avoid."),
  limitValue: nullableNumField().describe("Limit value for limit_avoid goals."),
  basePoints: numField().describe("Points awarded per task completion."),
  status: z.enum(GOAL_STATUSES).optional().describe("active | completed | abandoned."),
};

export const goalCreateSchema = z.object({
  ...goalFields,
  name: z.string().min(1).describe("Goal name."), // required for create
});

export const goalEditSchema = z.object(goalFields);

// MCP edit tool: same shape but with goalId required (URL param in REST, arg in MCP).
export const goalEditMcpSchema = z.object({
  goalId: z.number().int().meta({ description: "The goal ID to edit." }),
  ...goalFields,
}).strict();

// MCP create tool: name required.
export const goalCreateMcpSchema = goalCreateSchema;

export type GoalCreateInput = z.infer<typeof goalCreateSchema>;
export type GoalEditInput = z.infer<typeof goalEditSchema>;

// Apply DB-specific transforms after validation: scheduleDays array → JSON string,
// 0-as-unlink coercion for FK fields. Keeps DB-quirks out of the schema itself.
export function applyGoalDbTransforms(parsed: Partial<GoalEditInput>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...parsed };
  if ("scheduleDays" in parsed) {
    out.scheduleDays = parsed.scheduleDays && parsed.scheduleDays.length > 0
      ? JSON.stringify(parsed.scheduleDays)
      : null;
  }
  if (parsed.pillarId === 0) out.pillarId = null;
  if (parsed.periodId === 0) out.periodId = null;
  return out;
}
