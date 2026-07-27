// Single source of truth for cycle field shapes.

import { z } from "zod";
import { strField, nullableStrField } from "./common";

const cycleFields = {
  name: strField().describe("Cycle name (e.g. 'April 2026')."),
  startDate: strField().describe("Start date (YYYY-MM-DD)."),
  endDate: strField().describe("End date (YYYY-MM-DD)."),
  vision: nullableStrField().describe("Vision statement for this cycle."),
  theme: nullableStrField().describe("Theme for this cycle."),
};

export const cycleCreateSchema = z.object({
  ...cycleFields,
  name: z.string().min(1).describe("Cycle name."),
  startDate: z.string().describe("Start date (YYYY-MM-DD)."),
  endDate: z.string().optional().describe("End date (YYYY-MM-DD). Defaults to one month after startDate if omitted."),
});

export const cycleEditSchema = z.object(cycleFields);

export const cycleEditMcpSchema = z.object({
  cycleId: z.number().int().describe("The cycle ID to edit."),
  ...cycleFields,
});

export type CycleEditInput = z.infer<typeof cycleEditSchema>;

export function applyCycleDbTransforms(parsed: Partial<CycleEditInput>): Record<string, unknown> {
  return { ...parsed };
}
