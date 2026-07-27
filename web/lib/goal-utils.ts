// Shared helpers for goal mutations used by REST and MCP handlers.
// Field validation is delegated to lib/schemas/goal.ts (the single source of truth).

import { goalEditSchema, applyGoalDbTransforms, type GoalEditInput } from "@/lib/schemas/goal";

// Validate + apply DB transforms in one step. Throws ZodError on bad input
// (callers should wrap in try/catch and return 400).
export function mapGoalUpdateFields(src: unknown): Record<string, unknown> {
  const parsed: GoalEditInput = goalEditSchema.parse(src ?? {});
  return applyGoalDbTransforms(parsed);
}

// Build the (tasks, schedules) propagation pair for a goal edit.
// Project goals have independently-named subtasks, so name/unit/completionType/
// flexibilityRule must not be force-propagated onto their linked tasks.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildGoalPropagationPair(src: any, goalType?: string | null): { tasks: Record<string, unknown>; schedules: Record<string, unknown> } {
  const t: Record<string, unknown> = {};
  const s: Record<string, unknown> = {};
  const isProject = goalType === 'project';
  const set = (key: string, val: unknown, scheduleKey: string = key) => { t[key] = val; s[scheduleKey] = val; };
  if (!isProject && src.name !== undefined) set('name', src.name);
  if (src.pillarId !== undefined) set('pillarId', src.pillarId || null);
  if (!isProject && src.completionType !== undefined) set('completionType', src.completionType);
  if (!isProject && src.unit !== undefined) set('unit', src.unit || null);
  if (!isProject && src.flexibilityRule !== undefined) set('flexibilityRule', src.flexibilityRule);
  if (src.limitValue !== undefined) set('limitValue', src.limitValue ?? null);
  // dailyTarget on the goal maps to "target" on tasks/schedules
  if (!isProject && src.dailyTarget !== undefined) { t.target = src.dailyTarget; s.target = src.dailyTarget; }
  if (src.basePoints !== undefined) set('basePoints', src.basePoints ?? 10);
  if (src.periodId !== undefined) set('periodId', src.periodId || null);
  return { tasks: t, schedules: s };
}
