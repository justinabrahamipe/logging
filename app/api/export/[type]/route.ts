import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type } = await params;
  const userId = session.user.id;

  try {
    let csvData = "";
    let filename = `${type}-export.csv`;

    switch (type) {
      case "activities": {
        // Export all activity types (not user-specific)
        const activities = await prisma.activity.findMany({
          orderBy: { created_on: "desc" },
        });
        csvData = "Title,Category,Icon,Color,Created On\n";
        activities.forEach((activity) => {
          csvData += `"${activity.title}","${activity.category}","${activity.icon}","${activity.color || ""}",${activity.created_on.toISOString()}\n`;
        });
        break;
      }

      case "log": {
        const logs = await prisma.log.findMany({
          where: { userId },
          orderBy: { created_on: "desc" },
        });
        csvData = "Activity,Category,Start Time,End Time,Time Spent (min),Comment,Created On\n";
        logs.forEach((log) => {
          csvData += `"${log.activityTitle}","${log.activityCategory}",${log.start_time?.toISOString() || ""},${log.end_time?.toISOString() || ""},${log.time_spent || ""},"${(log.comment || "").replace(/"/g, '""')}",${log.created_on.toISOString()}\n`;
        });
        break;
      }

      case "bible": {
        // Bible data might be in another table - skipping for now or returning empty
        csvData = "Note: Bible data export not yet implemented\n";
        break;
      }

      case "todo": {
        const todos = await prisma.todo.findMany({
          where: { userId },
          orderBy: { created_on: "desc" },
        });
        csvData = "Title,Description,Activity,Done,Deadline,Created On\n";
        todos.forEach((todo) => {
          csvData += `"${todo.title}","${todo.description || ""}","${todo.activityTitle || ""}",${todo.done},${todo.deadline || ""},${todo.created_on.toISOString()}\n`;
        });
        break;
      }

      case "goals": {
        const goals = await prisma.goal.findMany({
          where: { userId },
          orderBy: { created_on: "desc" },
        });
        csvData = "Title,Description,Type,Metric Type,Target Value,Current Value,Start Date,End Date,Active,Created On\n";
        goals.forEach((goal) => {
          csvData += `"${goal.title}","${goal.description || ""}","${goal.goalType}","${goal.metricType}",${goal.targetValue},${goal.currentValue},${goal.startDate.toISOString()},${goal.endDate.toISOString()},${goal.isActive},${goal.created_on.toISOString()}\n`;
        });
        break;
      }

      case "people": {
        const people = await prisma.contact.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
        });
        csvData = "Name,Email,Phone,Organization,Job Title,Notes,Created At\n";
        people.forEach((person) => {
          csvData += `"${person.name}","${person.email || ""}","${person.phoneNumber || ""}","${person.organization || ""}","${person.jobTitle || ""}","${person.notes || ""}",${person.createdAt.toISOString()}\n`;
        });
        break;
      }

      case "places": {
        const places = await prisma.place.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
        });
        csvData = "Name,Address,Category,Description,Created At\n";
        places.forEach((place) => {
          csvData += `"${place.name}","${place.address}","${place.category || ""}","${place.description || ""}",${place.createdAt.toISOString()}\n`;
        });
        break;
      }

      case "finance": {
        const transactions = await prisma.financeTransaction.findMany({
          where: { userId },
          orderBy: { transactionDate: "desc" },
        });
        csvData = "Date,Description,Amount,Currency,Type,Category,Is Need,Created At\n";
        transactions.forEach((transaction) => {
          csvData += `${transaction.transactionDate.toISOString()},"${transaction.description}",${transaction.amount},"${transaction.currency}","${transaction.type}","${transaction.category || ""}",${transaction.isNeed},${transaction.createdAt.toISOString()}\n`;
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
    console.error(`Error exporting ${type}:`, error);
    return NextResponse.json(
      { error: `Failed to export ${type}` },
      { status: 500 }
    );
  }
}
