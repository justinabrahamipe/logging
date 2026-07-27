// Shared helpers for task and schedule mutations used by REST and MCP handlers.
// Field shapes are defined in lib/schemas/{task,pillar,cycle}.ts (single source of truth).

import { taskInstanceEditSchema, taskScheduleEditSchema, applyTaskInstanceDbTransforms, applyTaskScheduleDbTransforms } from "@/lib/schemas/task";
import { pillarEditSchema, applyPillarDbTransforms } from "@/lib/schemas/pillar";
import { cycleEditSchema, applyCycleDbTransforms } from "@/lib/schemas/cycle";

// Re-export so existing call sites that imported buildTaskPropagationFields keep working.
export { buildTaskPropagationFields } from "@/lib/schemas/task";

export function mapTaskUpdateFields(src: unknown): Record<string, unknown> {
  const parsed = taskInstanceEditSchema.parse(src ?? {});
  return applyTaskInstanceDbTransforms(parsed);
}

export function mapScheduleUpdateFields(src: unknown): Record<string, unknown> {
  const parsed = taskScheduleEditSchema.parse(src ?? {});
  return applyTaskScheduleDbTransforms(parsed);
}

export function mapPillarUpdateFields(src: unknown): Record<string, unknown> {
  const parsed = pillarEditSchema.parse(src ?? {});
  return applyPillarDbTransforms(parsed);
}

export function mapCycleUpdateFields(src: unknown): Record<string, unknown> {
  const parsed = cycleEditSchema.parse(src ?? {});
  return applyCycleDbTransforms(parsed);
}
