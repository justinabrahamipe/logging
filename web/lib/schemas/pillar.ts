// Single source of truth for pillar field shapes.

import { z } from "zod";
import { numField, strField, nullableStrField } from "./common";

const pillarFields = {
  name: strField().describe("Pillar name (e.g. 'Health', 'Career')."),
  emoji: strField().describe("Emoji icon. Defaults to '📌'."),
  color: strField().describe("Hex color (e.g. '#3B82F6'). Defaults to blue."),
  defaultBasePoints: numField().describe("Default base points for tasks in this pillar (default 10)."),
  description: nullableStrField().describe("Description of this pillar."),
};

export const pillarCreateSchema = z.object({
  ...pillarFields,
  name: z.string().min(1).describe("Pillar name."),
});

export const pillarEditSchema = z.object(pillarFields);

export const pillarEditMcpSchema = z.object({
  pillarId: z.number().int().describe("The pillar ID to edit."),
  ...pillarFields,
});

export type PillarEditInput = z.infer<typeof pillarEditSchema>;

export function applyPillarDbTransforms(parsed: Partial<PillarEditInput>): Record<string, unknown> {
  return { ...parsed };
}
