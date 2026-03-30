import { NextResponse } from "next/server";

export async function GET() {
  const spec = {
    openapi: "3.1.0",
    info: {
      title: "Grind Console API",
      description: "Access your productivity data — tasks, goals, scores, logs, and pillars.",
      version: "1.0.0",
    },
    servers: [
      { url: "https://www.grindconsole.com" },
    ],
    paths: {
      "/api/locations/public": {
        get: {
          operationId: "getData",
          summary: "Get user's productivity data",
          description: "Returns tasks, goals, scores, logs, and pillars. Use section param to filter. Use format=text for a human-readable summary.",
          parameters: [
            { name: "key", in: "query", required: true, schema: { type: "string" }, description: "API key for authentication" },
            { name: "section", in: "query", required: false, schema: { type: "string", enum: ["all", "logs", "tasks", "goals", "scores", "pillars"] }, description: "Which data section to return. Defaults to all." },
            { name: "format", in: "query", required: false, schema: { type: "string", enum: ["json", "text"] }, description: "Response format. 'text' gives human-readable output." },
            { name: "search", in: "query", required: false, schema: { type: "string" }, description: "Search/filter notes or task names" },
            { name: "from", in: "query", required: false, schema: { type: "string", format: "date" }, description: "Start date filter (YYYY-MM-DD)" },
            { name: "to", in: "query", required: false, schema: { type: "string", format: "date" }, description: "End date filter (YYYY-MM-DD)" },
          ],
          responses: {
            "200": {
              description: "Productivity data",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      logs: { type: "array", description: "Log entries with date, time, notes, and coordinates" },
                      tasks: { type: "array", description: "Task instances with completion status" },
                      goals: { type: "array", description: "Goals with progress, type, and status" },
                      scores: { type: "array", description: "Daily action scores and momentum" },
                      pillars: { type: "array", description: "Life pillars with default base points" },
                    },
                  },
                },
                "text/plain": {
                  schema: { type: "string" },
                },
              },
            },
            "401": { description: "Invalid or missing API key" },
          },
        },
      },
    },
  };

  return NextResponse.json(spec, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}
