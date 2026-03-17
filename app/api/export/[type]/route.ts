import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, pillars, tasks, taskSchedules } from "@/lib/db";
import { eq, and } from "drizzle-orm";

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
        csvData = "Name,Emoji,Color,Weight,Description,Archived,Sort Order\n";
        data.forEach((p) => {
          csvData += `"${p.name}","${p.emoji}","${p.color}",${p.weight},"${p.description || ""}",${p.isArchived},${p.sortOrder}\n`;
        });
        break;
      }

      case "tasks": {
        // Export task schedules (the recurring definitions)
        const data = await db.select().from(taskSchedules).where(and(eq(taskSchedules.userId, userId), eq(taskSchedules.isActive, true)));
        csvData = "Name,Pillar ID,Completion Type,Target,Unit,Frequency,Base Points,Active\n";
        data.forEach((t) => {
          csvData += `"${t.name}",${t.pillarId},"${t.completionType}",${t.target || ""},"${t.unit || ""}","${t.frequency}",${t.basePoints},${t.isActive}\n`;
        });
        break;
      }

      case "completions": {
        // Export task instances (concrete per-date data with completion)
        const data = await db.select().from(tasks).where(eq(tasks.userId, userId));
        csvData = "Task ID,Schedule ID,Date,Completed,Value,Points Earned\n";
        data.forEach((t) => {
          csvData += `${t.id},${t.scheduleId || ""},"${t.date}",${t.completed},${t.value || ""},${t.pointsEarned}\n`;
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
