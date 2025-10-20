import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // Delete all user data
    await prisma.$transaction([
      prisma.log.deleteMany({ where: { userId } }),
      prisma.todo.deleteMany({ where: { userId } }),
      prisma.goal.deleteMany({ where: { userId } }),
      prisma.contact.deleteMany({ where: { userId } }),
      prisma.place.deleteMany({ where: { userId } }),
      prisma.financeTransaction.deleteMany({ where: { userId } }),
      prisma.financeAccount.deleteMany({ where: { userId } }),
      prisma.financeCategory.deleteMany({ where: { userId } }),
      prisma.financeDebt.deleteMany({ where: { userId } }),
    ]);

    // Generate sample data
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Create sample finance account first
    const account = await prisma.financeAccount.create({
      data: {
        userId,
        name: "Main Checking",
        currency: "USD",
        type: "bank",
        balance: 5000,
        description: "Primary checking account",
      },
    });

    // Now create all sample data
    await prisma.$transaction([
      // Sample Logs
      prisma.log.createMany({
        data: [
          { userId, activityTitle: "Exercise", activityCategory: "Health", activityIcon: "🏃", start_time: now, end_time: new Date(now.getTime() + 30 * 60 * 1000), time_spent: 30, comment: "Morning jog in the park" },
          { userId, activityTitle: "Reading", activityCategory: "Learning", activityIcon: "📚", start_time: oneDayAgo, end_time: new Date(oneDayAgo.getTime() + 45 * 60 * 1000), time_spent: 45, comment: "Finished chapter 5" },
          { userId, activityTitle: "Coding", activityCategory: "Work", activityIcon: "💻", start_time: twoDaysAgo, end_time: new Date(twoDaysAgo.getTime() + 120 * 60 * 1000), time_spent: 120, comment: "Worked on new features" },
          { userId, activityTitle: "Meditation", activityCategory: "Wellness", activityIcon: "🧘", start_time: oneWeekAgo, end_time: new Date(oneWeekAgo.getTime() + 20 * 60 * 1000), time_spent: 20, comment: "Morning meditation session" },
        ],
      }),

      // Sample Todos
      prisma.todo.createMany({
        data: [
          { userId, title: "Complete project proposal", description: "Write and submit the Q1 project proposal", activityTitle: "Work", activityCategory: "Work", done: false, deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() },
          { userId, title: "Review pull requests", description: "Review 3 pending PRs", activityTitle: "Coding", activityCategory: "Work", done: true, deadline: oneDayAgo.toISOString() },
          { userId, title: "Update documentation", description: "Add examples for new API endpoints", activityTitle: "Work", activityCategory: "Work", done: false },
          { userId, title: "Prepare presentation", description: "Create slides for team meeting", activityTitle: "Work", activityCategory: "Work", done: true, deadline: twoDaysAgo.toISOString() },
        ],
      }),

      // Sample Goals
      prisma.goal.createMany({
        data: [
          { userId, title: "Learn React Advanced Patterns", description: "Master hooks, context, and performance optimization", goalType: "achievement", metricType: "time", targetValue: 20, currentValue: 5, periodType: "month", startDate: now, endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), activityTitle: "Learning", activityCategory: "Learning" },
          { userId, title: "Exercise 3 times per week", description: "Maintain a consistent fitness routine", goalType: "achievement", metricType: "count", targetValue: 12, currentValue: 4, periodType: "month", startDate: now, endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), activityTitle: "Exercise", activityCategory: "Health" },
          { userId, title: "Read 2 books this month", description: "One technical, one fiction", goalType: "achievement", metricType: "count", targetValue: 2, currentValue: 2, periodType: "month", startDate: oneWeekAgo, endDate: now, activityTitle: "Reading", activityCategory: "Learning", isActive: false },
        ],
      }),

      // Sample People
      prisma.contact.createMany({
        data: [
          { userId, name: "John Smith", email: "john.smith@example.com", phoneNumber: "555-0101", organization: "Tech Corp", jobTitle: "Project Manager", notes: "Great collaboration on Q4 project" },
          { userId, name: "Sarah Johnson", email: "sarah.j@example.com", phoneNumber: "555-0102", organization: "Dev Inc", jobTitle: "Lead Developer", notes: "Technical mentor" },
          { userId, name: "Mike Wilson", email: "mike.w@example.com", phoneNumber: "555-0103", organization: "Design Studio", jobTitle: "UX Designer", notes: "Worked together on mobile app redesign" },
        ],
      }),

      // Sample Places
      prisma.place.createMany({
        data: [
          { userId, name: "Central Park", address: "New York, NY", category: "outdoor", description: "Great for morning jogs and weekend walks" },
          { userId, name: "Coffee Shop Downtown", address: "123 Main St", category: "work", description: "Good WiFi, quiet atmosphere, perfect for remote work" },
          { userId, name: "Public Library", address: "456 Oak Ave", category: "work", description: "Perfect for focused work and research" },
        ],
      }),

      // Sample Finance Transactions
      prisma.financeTransaction.createMany({
        data: [
          { userId, description: "Grocery Shopping", amount: 125.50, currency: "USD", type: "expense", category: "Food", isNeed: true, transactionDate: now, fromAccountId: account.id },
          { userId, description: "Freelance Payment", amount: 1500.00, currency: "USD", type: "income", category: "Work", isNeed: true, transactionDate: oneDayAgo, toAccountId: account.id },
          { userId, description: "Gas", amount: 45.00, currency: "USD", type: "expense", category: "Transportation", isNeed: true, transactionDate: twoDaysAgo, fromAccountId: account.id },
          { userId, description: "Monthly Salary", amount: 5000.00, currency: "USD", type: "income", category: "Work", isNeed: true, transactionDate: oneWeekAgo, toAccountId: account.id },
          { userId, description: "Dinner Out", amount: 60.00, currency: "USD", type: "expense", category: "Food", isNeed: false, transactionDate: oneWeekAgo, fromAccountId: account.id },
        ],
      }),
    ]);

    return NextResponse.json({ success: true, message: "Factory reset completed and sample data generated" });
  } catch (error) {
    console.error("Error during factory reset:", error);
    return NextResponse.json(
      { error: "Failed to perform factory reset" },
      { status: 500 }
    );
  }
}
