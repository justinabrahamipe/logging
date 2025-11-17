import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, financeTransactions, financeAccounts } from "@/lib/db";
import { eq, gte } from "drizzle-orm";

export const maxDuration = 10;
export const dynamic = 'force-dynamic';

// GET /api/finance/reports/stats - Get summary statistics for different periods
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const now = new Date();

    // Start of today
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Start of this week (Monday)
    const startOfWeek = new Date(now);
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If Sunday (0), go back 6 days, else go back to Monday
    startOfWeek.setDate(now.getDate() - daysToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    // Start of this month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Fetch all transactions for the user
    const transactions = await db.select().from(financeTransactions).where(
      eq(financeTransactions.userId, session.user.id)
    );

    // Filter transactions from start of month onwards
    const transactionsFromMonth = transactions.filter(
      t => t.transactionDate && t.transactionDate >= startOfMonth
    );

    // Calculate statistics
    const calculateStats = (filterDate: Date) => {
      const filtered = transactionsFromMonth.filter(t => t.transactionDate && t.transactionDate >= filterDate);

      const income = filtered
        .filter(t => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);

      const expense = filtered
        .filter(t => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        income,
        expense,
        balance: income - expense,
      };
    };

    const todayStats = calculateStats(startOfToday);
    const weekStats = calculateStats(startOfWeek);
    const monthStats = calculateStats(startOfMonth);

    // Get account summaries
    const accounts = await db.select({
      id: financeAccounts.id,
      name: financeAccounts.name,
      balance: financeAccounts.balance,
      currency: financeAccounts.currency,
      type: financeAccounts.type,
    }).from(financeAccounts).where(eq(financeAccounts.userId, session.user.id));

    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

    return NextResponse.json({
      today: todayStats,
      week: weekStats,
      month: monthStats,
      accounts: {
        total: accounts.length,
        totalBalance,
        accounts,
      },
    });
  } catch (error) {
    console.error("Error fetching report stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch report statistics" },
      { status: 500 }
    );
  }
}
