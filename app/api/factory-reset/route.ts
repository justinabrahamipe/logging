import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, logs, todos, goals, contacts, places, financeTransactions, financeAccounts, financeCategories, financeDebts } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // Delete all user data
    await db.transaction(async (tx) => {
      await tx.delete(logs).where(eq(logs.userId, userId));
      await tx.delete(todos).where(eq(todos.userId, userId));
      await tx.delete(goals).where(eq(goals.userId, userId));
      await tx.delete(contacts).where(eq(contacts.userId, userId));
      await tx.delete(places).where(eq(places.userId, userId));
      await tx.delete(financeTransactions).where(eq(financeTransactions.userId, userId));
      await tx.delete(financeAccounts).where(eq(financeAccounts.userId, userId));
      await tx.delete(financeCategories).where(eq(financeCategories.userId, userId));
      await tx.delete(financeDebts).where(eq(financeDebts.userId, userId));
    });

    // Generate sample data
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Create sample finance account first
    const [account] = await db.insert(financeAccounts).values({
      userId,
      name: "Main Checking",
      currency: "USD",
      type: "bank",
      balance: 5000,
      description: "Primary checking account",
    }).returning();

    // Now create all sample data
    await db.transaction(async (tx) => {
      // Sample Logs
      await tx.insert(logs).values([
        { userId, activityTitle: "Exercise", activityCategory: "Health", activityIcon: "🏃", startTime: now, endTime: new Date(now.getTime() + 30 * 60 * 1000), timeSpent: 30, comment: "Morning jog in the park" },
        { userId, activityTitle: "Reading", activityCategory: "Learning", activityIcon: "📚", startTime: oneDayAgo, endTime: new Date(oneDayAgo.getTime() + 45 * 60 * 1000), timeSpent: 45, comment: "Finished chapter 5" },
        { userId, activityTitle: "Coding", activityCategory: "Work", activityIcon: "💻", startTime: twoDaysAgo, endTime: new Date(twoDaysAgo.getTime() + 120 * 60 * 1000), timeSpent: 120, comment: "Worked on new features" },
        { userId, activityTitle: "Meditation", activityCategory: "Wellness", activityIcon: "🧘", startTime: oneWeekAgo, endTime: new Date(oneWeekAgo.getTime() + 20 * 60 * 1000), timeSpent: 20, comment: "Morning meditation session" },
      ]);

      // Sample Todos
      await tx.insert(todos).values([
        { userId, title: "Complete project proposal", description: "Write and submit the Q1 project proposal", activityTitle: "Work", activityCategory: "Work", done: false, deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() },
        { userId, title: "Review pull requests", description: "Review 3 pending PRs", activityTitle: "Coding", activityCategory: "Work", done: true, deadline: oneDayAgo.toISOString() },
        { userId, title: "Update documentation", description: "Add examples for new API endpoints", activityTitle: "Work", activityCategory: "Work", done: false },
        { userId, title: "Prepare presentation", description: "Create slides for team meeting", activityTitle: "Work", activityCategory: "Work", done: true, deadline: twoDaysAgo.toISOString() },
      ]);

      // Sample Goals
      await tx.insert(goals).values([
        { userId, title: "Learn React Advanced Patterns", description: "Master hooks, context, and performance optimization", goalType: "achievement", metricType: "time", targetValue: 20, currentValue: 5, periodType: "month", startDate: now, endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), activityTitle: "Learning", activityCategory: "Learning" },
        { userId, title: "Exercise 3 times per week", description: "Maintain a consistent fitness routine", goalType: "achievement", metricType: "count", targetValue: 12, currentValue: 4, periodType: "month", startDate: now, endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), activityTitle: "Exercise", activityCategory: "Health" },
        { userId, title: "Read 2 books this month", description: "One technical, one fiction", goalType: "achievement", metricType: "count", targetValue: 2, currentValue: 2, periodType: "month", startDate: oneWeekAgo, endDate: now, activityTitle: "Reading", activityCategory: "Learning", isActive: false },
      ]);

      // Sample People
      await tx.insert(contacts).values([
        { userId, name: "John Smith", email: "john.smith@example.com", phoneNumber: "555-0101", organization: "Tech Corp", jobTitle: "Project Manager", notes: "Great collaboration on Q4 project" },
        { userId, name: "Sarah Johnson", email: "sarah.j@example.com", phoneNumber: "555-0102", organization: "Dev Inc", jobTitle: "Lead Developer", notes: "Technical mentor" },
        { userId, name: "Mike Wilson", email: "mike.w@example.com", phoneNumber: "555-0103", organization: "Design Studio", jobTitle: "UX Designer", notes: "Worked together on mobile app redesign" },
      ]);

      // Sample Places
      await tx.insert(places).values([
        { userId, name: "Central Park", address: "New York, NY", category: "outdoor", description: "Great for morning jogs and weekend walks" },
        { userId, name: "Coffee Shop Downtown", address: "123 Main St", category: "work", description: "Good WiFi, quiet atmosphere, perfect for remote work" },
        { userId, name: "Public Library", address: "456 Oak Ave", category: "work", description: "Perfect for focused work and research" },
      ]);

      // Sample Finance Transactions
      await tx.insert(financeTransactions).values([
        { userId, description: "Grocery Shopping", amount: 125.50, currency: "USD", type: "expense", category: "Food", isNeed: true, transactionDate: now, fromAccountId: account.id },
        { userId, description: "Freelance Payment", amount: 1500.00, currency: "USD", type: "income", category: "Work", isNeed: true, transactionDate: oneDayAgo, toAccountId: account.id },
        { userId, description: "Gas", amount: 45.00, currency: "USD", type: "expense", category: "Transportation", isNeed: true, transactionDate: twoDaysAgo, fromAccountId: account.id },
        { userId, description: "Monthly Salary", amount: 5000.00, currency: "USD", type: "income", category: "Work", isNeed: true, transactionDate: oneWeekAgo, toAccountId: account.id },
        { userId, description: "Dinner Out", amount: 60.00, currency: "USD", type: "expense", category: "Food", isNeed: false, transactionDate: oneWeekAgo, fromAccountId: account.id },
      ]);
    });

    return NextResponse.json({ success: true, message: "Factory reset completed and sample data generated" });
  } catch (error) {
    console.error("Error during factory reset:", error);
    return NextResponse.json(
      { error: "Failed to perform factory reset" },
      { status: 500 }
    );
  }
}
