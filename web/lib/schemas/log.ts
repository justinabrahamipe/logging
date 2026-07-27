// Single source of truth for add_log MCP tool.

import { z } from "zod";

export const addLogMcpSchema = z.object({
  notes: z.string().min(1).describe("The log text/notes."),
  date: z.string().optional().describe("Date for the log (YYYY-MM-DD). Defaults to today."),
  time: z.string().optional().describe("Time for the log (HH:MM). Defaults to current time."),
  latitude: z.number().optional().describe("Latitude (-90 to 90). Defaults to 0."),
  longitude: z.number().optional().describe("Longitude (-180 to 180). Defaults to 0."),
});
