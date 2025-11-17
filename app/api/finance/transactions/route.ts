import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, financeTransactions, financeAccounts, financeTransactionContacts, financeTransactionPlaces } from "@/lib/db";
import { insertManyIgnoreDuplicates } from "@/lib/drizzle-utils";
import { eq, desc, and, sql } from "drizzle-orm";

export const maxDuration = 10;
export const dynamic = 'force-dynamic';

// Helper function to update account balances
async function updateAccountBalance(accountId: number, amount: number) {
  await db.update(financeAccounts)
    .set({ balance: sql`${financeAccounts.balance} + ${amount}` })
    .where(eq(financeAccounts.id, accountId));
}

// GET /api/finance/transactions - Get all transactions for user
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const transactions = await db.query.financeTransactions.findMany({
      where: eq(financeTransactions.userId, session.user.id),
      orderBy: [desc(financeTransactions.transactionDate)],
      with: {
        fromAccount: true,
        toAccount: true,
        transactionContacts: {
          with: {
            contact: {
              columns: {
                id: true,
                name: true,
                photoUrl: true,
              },
            },
          },
        },
        transactionPlaces: {
          with: {
            place: {
              columns: {
                id: true,
                name: true,
                address: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ data: transactions });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

// POST /api/finance/transactions - Create new transaction
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      fromAccountId,
      toAccountId,
      amount,
      currency,
      exchangeRate,
      convertedAmount,
      type,
      category,
      description,
      isNeed,
      transactionDate,
      contactIds,
      placeIds,
    } = body;

    // Validate required fields
    if (!amount || !currency || !type || !description || !transactionDate) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate transaction type
    const validTypes = ["income", "expense", "transfer"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: "Invalid transaction type" },
        { status: 400 }
      );
    }

    // Create transaction
    const [transaction] = await db.insert(financeTransactions).values({
      userId: session.user.id,
      fromAccountId: fromAccountId || null,
      toAccountId: toAccountId || null,
      amount,
      currency,
      exchangeRate: exchangeRate || null,
      convertedAmount: convertedAmount || null,
      type,
      category: category || null,
      description,
      isNeed: isNeed ?? true,
      transactionDate: new Date(transactionDate),
    }).returning();

    // Link contacts if provided
    if (contactIds && contactIds.length > 0) {
      await insertManyIgnoreDuplicates(
        financeTransactionContacts,
        contactIds.map((contactId: number) => ({
          transactionId: transaction.id,
          contactId,
        }))
      );
    }

    // Link places if provided
    if (placeIds && placeIds.length > 0) {
      await insertManyIgnoreDuplicates(
        financeTransactionPlaces,
        placeIds.map((placeId: number) => ({
          transactionId: transaction.id,
          placeId,
        }))
      );
    }

    // Update account balances
    if (type === "expense" && fromAccountId) {
      await updateAccountBalance(fromAccountId, -amount);
    } else if (type === "income" && toAccountId) {
      await updateAccountBalance(toAccountId, amount);
    } else if (type === "transfer" && fromAccountId && toAccountId) {
      await updateAccountBalance(fromAccountId, -amount);
      const amountToAdd = convertedAmount || amount;
      await updateAccountBalance(toAccountId, amountToAdd);
    }

    // Fetch the complete transaction with relationships
    const fullTransaction = await db.query.financeTransactions.findFirst({
      where: eq(financeTransactions.id, transaction.id),
      with: {
        fromAccount: true,
        toAccount: true,
        transactionContacts: {
          with: {
            contact: true,
          },
        },
        transactionPlaces: {
          with: {
            place: true,
          },
        },
      },
    });

    return NextResponse.json(fullTransaction, { status: 201 });
  } catch (error) {
    console.error("Error creating transaction:", error);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}

// PUT /api/finance/transactions - Update transaction
export async function PUT(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      id,
      fromAccountId,
      toAccountId,
      amount,
      currency,
      exchangeRate,
      convertedAmount,
      type,
      category,
      description,
      isNeed,
      transactionDate,
      contactIds,
      placeIds,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Transaction ID is required" },
        { status: 400 }
      );
    }

    // Get existing transaction to reverse balance changes
    const existingTransaction = await db.query.financeTransactions.findFirst({
      where: and(
        eq(financeTransactions.id, id),
        eq(financeTransactions.userId, session.user.id)
      ),
    });

    if (!existingTransaction) {
      return NextResponse.json(
        { error: "Transaction not found or unauthorized" },
        { status: 404 }
      );
    }

    // Reverse old balance changes
    if (existingTransaction.type === "expense" && existingTransaction.fromAccountId) {
      await updateAccountBalance(existingTransaction.fromAccountId, existingTransaction.amount);
    } else if (existingTransaction.type === "income" && existingTransaction.toAccountId) {
      await updateAccountBalance(existingTransaction.toAccountId, -existingTransaction.amount);
    } else if (existingTransaction.type === "transfer" && existingTransaction.fromAccountId && existingTransaction.toAccountId) {
      await updateAccountBalance(existingTransaction.fromAccountId, existingTransaction.amount);
      const oldAmountToSubtract = existingTransaction.convertedAmount || existingTransaction.amount;
      await updateAccountBalance(existingTransaction.toAccountId, -oldAmountToSubtract);
    }

    // Delete existing contacts and places
    await db.delete(financeTransactionContacts).where(eq(financeTransactionContacts.transactionId, id));
    await db.delete(financeTransactionPlaces).where(eq(financeTransactionPlaces.transactionId, id));

    // Update transaction
    await db.update(financeTransactions)
      .set({
        fromAccountId: fromAccountId !== undefined ? fromAccountId : existingTransaction.fromAccountId,
        toAccountId: toAccountId !== undefined ? toAccountId : existingTransaction.toAccountId,
        amount: amount ?? existingTransaction.amount,
        currency: currency || existingTransaction.currency,
        exchangeRate: exchangeRate !== undefined ? exchangeRate : existingTransaction.exchangeRate,
        convertedAmount: convertedAmount !== undefined ? convertedAmount : existingTransaction.convertedAmount,
        type: type || existingTransaction.type,
        category: category !== undefined ? category : existingTransaction.category,
        description: description || existingTransaction.description,
        isNeed: isNeed ?? existingTransaction.isNeed,
        transactionDate: transactionDate ? new Date(transactionDate) : existingTransaction.transactionDate,
      })
      .where(eq(financeTransactions.id, id));

    // Link new contacts and places
    if (contactIds && contactIds.length > 0) {
      await insertManyIgnoreDuplicates(
        financeTransactionContacts,
        contactIds.map((contactId: number) => ({
          transactionId: id,
          contactId,
        }))
      );
    }

    if (placeIds && placeIds.length > 0) {
      await insertManyIgnoreDuplicates(
        financeTransactionPlaces,
        placeIds.map((placeId: number) => ({
          transactionId: id,
          placeId,
        }))
      );
    }

    // Apply new balance changes
    const finalType = type || existingTransaction.type;
    const finalAmount = amount ?? existingTransaction.amount;
    const finalFromAccountId = fromAccountId !== undefined ? fromAccountId : existingTransaction.fromAccountId;
    const finalToAccountId = toAccountId !== undefined ? toAccountId : existingTransaction.toAccountId;

    if (finalType === "expense" && finalFromAccountId) {
      await updateAccountBalance(finalFromAccountId, -finalAmount);
    } else if (finalType === "income" && finalToAccountId) {
      await updateAccountBalance(finalToAccountId, finalAmount);
    } else if (finalType === "transfer" && finalFromAccountId && finalToAccountId) {
      await updateAccountBalance(finalFromAccountId, -finalAmount);
      const amountToAdd = convertedAmount !== undefined ? convertedAmount : (existingTransaction.convertedAmount || finalAmount);
      await updateAccountBalance(finalToAccountId, amountToAdd);
    }

    // Fetch the updated transaction with relationships
    const transaction = await db.query.financeTransactions.findFirst({
      where: eq(financeTransactions.id, id),
      with: {
        fromAccount: true,
        toAccount: true,
        transactionContacts: {
          with: {
            contact: true,
          },
        },
        transactionPlaces: {
          with: {
            place: true,
          },
        },
      },
    });

    return NextResponse.json(transaction);
  } catch (error) {
    console.error("Error updating transaction:", error);
    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 500 }
    );
  }
}

// DELETE /api/finance/transactions - Delete transaction
export async function DELETE(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Transaction ID is required" },
        { status: 400 }
      );
    }

    // Get existing transaction to reverse balance changes
    const existingTransaction = await db.query.financeTransactions.findFirst({
      where: and(
        eq(financeTransactions.id, parseInt(id)),
        eq(financeTransactions.userId, session.user.id)
      ),
    });

    if (!existingTransaction) {
      return NextResponse.json(
        { error: "Transaction not found or unauthorized" },
        { status: 404 }
      );
    }

    // Reverse balance changes
    if (existingTransaction.type === "expense" && existingTransaction.fromAccountId) {
      await updateAccountBalance(existingTransaction.fromAccountId, existingTransaction.amount);
    } else if (existingTransaction.type === "income" && existingTransaction.toAccountId) {
      await updateAccountBalance(existingTransaction.toAccountId, -existingTransaction.amount);
    } else if (existingTransaction.type === "transfer" && existingTransaction.fromAccountId && existingTransaction.toAccountId) {
      await updateAccountBalance(existingTransaction.fromAccountId, existingTransaction.amount);
      const amountToSubtract = existingTransaction.convertedAmount || existingTransaction.amount;
      await updateAccountBalance(existingTransaction.toAccountId, -amountToSubtract);
    }

    await db.delete(financeTransactions).where(eq(financeTransactions.id, parseInt(id)));

    return NextResponse.json({ message: "Transaction deleted successfully" });
  } catch (error) {
    console.error("Error deleting transaction:", error);
    return NextResponse.json(
      { error: "Failed to delete transaction" },
      { status: 500 }
    );
  }
}
