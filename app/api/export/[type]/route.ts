import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, activities, logs, todos, goals, contacts, places, financeTransactions } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

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
        const activitiesData = await db.select().from(activities).orderBy(desc(activities.createdOn));
        csvData = "Title,Category,Icon,Color,Created On\n";
        activitiesData.forEach((activity) => {
          csvData += `"${activity.title}","${activity.category}","${activity.icon}","${activity.color || ""}",${activity.createdOn.toISOString()}\n`;
        });
        break;
      }

      case "log": {
        const logsData = await db.select().from(logs).where(eq(logs.userId, userId)).orderBy(desc(logs.createdOn));
        csvData = "Activity,Category,Start Time,End Time,Time Spent (min),Comment,Created On\n";
        logsData.forEach((log) => {
          csvData += `"${log.activityTitle}","${log.activityCategory}",${log.startTime?.toISOString() || ""},${log.endTime?.toISOString() || ""},${log.timeSpent || ""},"${(log.comment || "").replace(/"/g, '""')}",${log.createdOn.toISOString()}\n`;
        });
        break;
      }

      case "bible": {
        // Bible data might be in another table - skipping for now or returning empty
        csvData = "Note: Bible data export not yet implemented\n";
        break;
      }

      case "todo": {
        const todosData = await db.select().from(todos).where(eq(todos.userId, userId)).orderBy(desc(todos.createdOn));
        csvData = "Title,Description,Activity,Done,Deadline,Created On\n";
        todosData.forEach((todo) => {
          csvData += `"${todo.title}","${todo.description || ""}","${todo.activityTitle || ""}",${todo.done},${todo.deadline || ""},${todo.createdOn.toISOString()}\n`;
        });
        break;
      }

      case "goals": {
        const goalsData = await db.select().from(goals).where(eq(goals.userId, userId)).orderBy(desc(goals.createdOn));
        csvData = "Title,Description,Type,Metric Type,Target Value,Current Value,Start Date,End Date,Active,Created On\n";
        goalsData.forEach((goal) => {
          csvData += `"${goal.title}","${goal.description || ""}","${goal.goalType}","${goal.metricType}",${goal.targetValue},${goal.currentValue},${goal.startDate.toISOString()},${goal.endDate.toISOString()},${goal.isActive},${goal.createdOn.toISOString()}\n`;
        });
        break;
      }

      case "people": {
        const people = await db.select().from(contacts).where(eq(contacts.userId, userId)).orderBy(desc(contacts.createdAt));
        csvData = "Name,Email,Phone,Organization,Job Title,Notes,Created At\n";
        people.forEach((person) => {
          csvData += `"${person.name}","${person.email || ""}","${person.phoneNumber || ""}","${person.organization || ""}","${person.jobTitle || ""}","${person.notes || ""}",${person.createdAt.toISOString()}\n`;
        });
        break;
      }

      case "places": {
        const placesData = await db.select().from(places).where(eq(places.userId, userId)).orderBy(desc(places.createdAt));
        csvData = "Name,Address,Category,Description,Created At\n";
        placesData.forEach((place) => {
          csvData += `"${place.name}","${place.address}","${place.category || ""}","${place.description || ""}",${place.createdAt.toISOString()}\n`;
        });
        break;
      }

      case "finance": {
        const transactions = await db.select().from(financeTransactions).where(eq(financeTransactions.userId, userId)).orderBy(desc(financeTransactions.transactionDate));
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
