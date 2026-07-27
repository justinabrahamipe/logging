import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse, escapeCSV } from "@/lib/api-utils";
import { db, pillars, tasks, taskSchedules } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();

    const { type } = await params;

    let csvData = "";
    const filename = `${type}-export.csv`;

    switch (type) {
      case "pillars": {
        const data = await db.select().from(pillars).where(eq(pillars.userId, userId));
        csvData = "Name,Emoji,Color,DefaultBasePoints,Description\n";
        data.forEach((p) => {
          csvData += `${escapeCSV(p.name)},${escapeCSV(p.emoji)},${escapeCSV(p.color)},${p.defaultBasePoints},${escapeCSV(p.description)}\n`;
        });
        break;
      }

      case "tasks": {
        // Export task schedules (the recurring definitions)
        const data = await db.select().from(taskSchedules).where(eq(taskSchedules.userId, userId));
        csvData = "Name,Pillar ID,Completion Type,Target,Unit,Frequency,Base Points\n";
        data.forEach((t) => {
          csvData += `${escapeCSV(t.name)},${t.pillarId},${escapeCSV(t.completionType)},${t.target || ""},${escapeCSV(t.unit)},${escapeCSV(t.frequency)},${t.basePoints}\n`;
        });
        break;
      }

      case "completions": {
        // Export task instances (concrete per-date data with completion)
        const data = await db.select().from(tasks).where(eq(tasks.userId, userId));
        csvData = "Task ID,Schedule ID,Date,Completed,Value,Points Earned\n";
        data.forEach((t) => {
          csvData += `${t.id},${t.scheduleId || ""},${escapeCSV(t.date)},${t.completed},${t.value || ""},${t.pointsEarned}\n`;
        });
        break;
      }

      default:
        return NextResponse.json({ error: "Invalid export type" }, { status: 400 });
    }

    return new NextResponse(csvData, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
