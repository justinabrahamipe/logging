// Single source of truth for task and task-schedule field shapes.

import { z } from "zod";
import { numField, nullableNumField, intField, strField, nullableStrField } from "./common";
import { COMPLETION_TYPES, FLEXIBILITY_RULES } from "./goal";

export const TASK_FREQUENCIES = ["adhoc", "daily", "weekdays", "weekends", "custom", "monthly", "interval", "weekly"] as const;

// Fields that exist on a task instance row (the `tasks` table).
const taskInstanceFields = {
  name: strField().describe("Task name."),
  pillarId: intField().describe("Pillar ID. Pass 0 or null to unlink."),
  completionType: z.enum(COMPLETION_TYPES).optional().describe("checkbox | count | numeric | duration."),
  target: nullableNumField().describe("Target value for count/numeric/duration tasks."),
  unit: nullableStrField().describe("Unit label (e.g. 'minutes', 'pages')."),
  basePoints: numField().describe("Points awarded on completion. Defaults to 10."),
  goalId: intField().describe("Goal ID to link to. Pass 0 or null to unlink."),
  periodId: intField().describe("Cycle/period ID. Pass 0 or null to unlink."),
  date: nullableStrField().describe("Date (YYYY-MM-DD). Empty for no-date tasks."),
  flexibilityRule: z.enum(FLEXIBILITY_RULES).optional().describe("must_today | at_least | limit_avoid."),
  limitValue: nullableNumField().describe("Limit value for limit_avoid tasks."),
  description: nullableStrField().describe("Optional description/notes."),
};

// Fields that exist on a recurring schedule row (the `taskSchedules` table).
const taskScheduleFields = {
  name: strField().describe("Task name."),
  pillarId: intField().describe("Pillar ID. Pass 0 or null to unlink."),
  completionType: z.enum(COMPLETION_TYPES).optional().describe("checkbox | count | numeric | duration."),
  target: nullableNumField().describe("Target value."),
  unit: nullableStrField().describe("Unit label."),
  flexibilityRule: z.enum(FLEXIBILITY_RULES).optional().describe("must_today | at_least | limit_avoid."),
  frequency: z.enum(TASK_FREQUENCIES).optional().describe("Recurrence pattern."),
  customDays: nullableStrField().describe("JSON or comma-separated days for custom/monthly frequencies."),
  repeatInterval: nullableNumField().describe("Repeat interval (e.g. every 2 weeks)."),
  basePoints: numField().describe("Points awarded on completion."),
  limitValue: nullableNumField().describe("Limit value for limit_avoid."),
  goalId: intField().describe("Goal ID to link to. Pass 0 or null to unlink."),
  periodId: intField().describe("Cycle/period ID. Pass 0 or null to unlink."),
  startDate: nullableStrField().describe("Start date (YYYY-MM-DD)."),
  endDate: nullableStrField().describe("End date (YYYY-MM-DD)."),
  description: nullableStrField().describe("Optional description/notes."),
};

// One combined "create" schema covers both adhoc tasks and recurring schedules — the
// handler branches on `frequency`. All fields optional except name (required for create).
export const taskCreateSchema = z.object({
  name: z.string().min(1).describe("Task name."),
  pillarId: intField().describe("Pillar ID."),
  completionType: z.enum(COMPLETION_TYPES).optional().describe("checkbox | count | numeric | duration. Defaults to checkbox."),
  target: nullableNumField().describe("Target value."),
  unit: nullableStrField().describe("Unit label."),
  basePoints: numField().describe("Points. Defaults to 10."),
  goalId: intField().describe("Goal ID. Inherits start date, pillar, period from the goal."),
  periodId: intField().describe("Cycle ID."),
  flexibilityRule: z.enum(FLEXIBILITY_RULES).optional().describe("must_today | at_least | limit_avoid."),
  limitValue: nullableNumField().describe("Limit value."),
  description: nullableStrField().describe("Optional notes."),
  // Schedule-only fields
  frequency: z.enum(TASK_FREQUENCIES).optional().describe("Recurrence (adhoc for one-off, daily/weekdays/etc for recurring)."),
  customDays: nullableStrField().describe("Comma-separated day names ('mon,tue') or JSON array. Used for custom/monthly frequencies."),
  repeatInterval: nullableNumField().describe("Repeat interval (every N days/weeks/months)."),
  startDate: nullableStrField().describe("Start date for recurring tasks (YYYY-MM-DD)."),
  endDate: nullableStrField().describe("End date for recurring tasks (YYYY-MM-DD)."),
  date: nullableStrField().describe("Date for adhoc tasks (YYYY-MM-DD)."),
});

export const taskInstanceEditSchema = z.object(taskInstanceFields);
export const taskScheduleEditSchema = z.object(taskScheduleFields);

// MCP tool wrappers — taskId required.
export const taskEditMcpSchema = z.object({
  taskId: z.number().int().describe("The task ID to edit."),
  ...taskInstanceFields,
});

export const taskCompleteMcpSchema = z.object({
  taskId: z.number().int().describe("The task instance ID."),
  value: z.number().optional().describe("Value to set (for numeric tasks)."),
  completed: z.boolean().optional().describe("Whether the task is completed. Defaults to true."),
});

export const taskDeleteMcpSchema = z.object({
  taskId: z.number().int().describe("The task ID to delete."),
});

export type TaskInstanceEditInput = z.infer<typeof taskInstanceEditSchema>;
export type TaskScheduleEditInput = z.infer<typeof taskScheduleEditSchema>;

// DB-specific transforms. Keeps coercion (0 → null, "" → null) out of the schema itself.
export function applyTaskInstanceDbTransforms(parsed: Partial<TaskInstanceEditInput>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...parsed };
  if (parsed.pillarId === 0) out.pillarId = null;
  if (parsed.goalId === 0) out.goalId = null;
  if (parsed.periodId === 0) out.periodId = null;
  if (parsed.date === "" || parsed.date === null) out.isHighlighted = false;
  return out;
}

export function applyTaskScheduleDbTransforms(parsed: Partial<TaskScheduleEditInput>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...parsed };
  if (parsed.pillarId === 0) out.pillarId = null;
  if (parsed.goalId === 0) out.goalId = null;
  if (parsed.periodId === 0) out.periodId = null;
  return out;
}

// Fields propagated from a schedule (or goal) onto its uncompleted future task instances.
const TASK_PROPAGATION_FIELDS = [
  "name", "pillarId", "completionType", "target", "unit", "basePoints",
  "flexibilityRule", "limitValue",
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildTaskPropagationFields(src: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of TASK_PROPAGATION_FIELDS) {
    if (src[f] !== undefined) out[f] = src[f];
  }
  if (src.pillarId !== undefined) out.pillarId = src.pillarId || null;
  if (src.unit !== undefined) out.unit = src.unit || null;
  if (src.limitValue !== undefined) out.limitValue = src.limitValue ?? null;
  return out;
}
