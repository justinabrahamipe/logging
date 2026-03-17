import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, pillars, tasks, taskCompletions } from "@/lib/db";
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
        const data = await db.select().from(tasks).where(and(eq(tasks.userId, userId), eq(tasks.isActive, true)));
        csvData = "Name,Pillar ID,Completion Type,Target,Unit,Frequency,Base Points,Active\n";
        data.forEach((t) => {
          csvData += `"${t.name}",${t.pillarId},"${t.completionType}",${t.target || ""},"${t.unit || ""}","${t.frequency}",${t.basePoints},${t.isActive}\n`;
        });
        break;
      }

      case "completions": {
        const data = await db.select().from(taskCompletions).where(eq(taskCompletions.userId, userId));
        csvData = "Task ID,Date,Completed,Value,Points Earned\n";
        data.forEach((c) => {
          csvData += `${c.taskId},"${c.date}",${c.completed},${c.value || ""},${c.pointsEarned}\n`;
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
