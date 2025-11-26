import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, financeTransactions, financeAccounts, contacts, places } from "@/lib/db";
import { eq, desc, and, sql, inArray } from "drizzle-orm";

export const maxDuration = 10;
export const dynamic = 'force-dynamic';

// Helper to parse contactIds string to array
function parseContactIds(contactIds: string | null): number[] {
  if (!contactIds) return [];
  return contactIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
}

// Helper to convert array to contactIds string
function stringifyContactIds(ids: number[]): string | null {
  if (!ids || ids.length === 0) return null;
  return ids.join(',');
}

// Helper to fetch contacts by IDs
async function fetchContacts(contactIds: number[]) {
  if (contactIds.length === 0) return [];
  const contactList = await db.select({
    id: contacts.id,
    name: contacts.name,
    photoUrl: contacts.photoUrl
  }).from(contacts).where(inArray(contacts.id, contactIds));
  return contactList;
}

// Helper function to update account balances
async function updateAccountBalance(accountId: number, amount: number) {
  await db.update(financeAccounts)
    .set({ balance: sql`${financeAccounts.balance} + ${amount}` })
    .where(eq(financeAccounts.id, accountId));
}

// Helper to enrich transaction with contacts
async function enrichTransaction(transaction: any) {
  const contactIdsList = parseContactIds(transaction.contactIds);
  const contactList = await fetchContacts(contactIdsList);
  return {
    ...transaction,
    contacts: contactList
  };
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
        place: {
          columns: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
    });

    // Enrich with contacts
    const enrichedTransactions = await Promise.all(transactions.map(enrichTransaction));

    return NextResponse.json({ data: enrichedTransactions });
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
      placeId: directPlaceId,
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

    // Handle placeId - take first one if array provided
    const placeId = Array.isArray(placeIds) && placeIds.length > 0
      ? parseInt(placeIds[0])
      : (directPlaceId ? parseInt(directPlaceId) : null);

    // Handle contactIds - convert array to comma-separated string
    const contactIdsStr = Array.isArray(contactIds) && contactIds.length > 0
      ? stringifyContactIds(contactIds)
      : null;

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
      placeId,
      contactIds: contactIdsStr,
    }).returning();

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
        place: true,
      },
    });

    // Enrich with contacts
    const enrichedTransaction = await enrichTransaction(fullTransaction);

    return NextResponse.json(enrichedTransaction, { status: 201 });
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
      placeId: directPlaceId,
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

    // Handle placeId - take first one if array provided
    let placeId = existingTransaction.placeId;
    if (placeIds !== undefined) {
      placeId = Array.isArray(placeIds) && placeIds.length > 0
        ? parseInt(placeIds[0])
        : null;
    } else if (directPlaceId !== undefined) {
      placeId = directPlaceId ? parseInt(directPlaceId) : null;
    }

    // Handle contactIds - convert array to comma-separated string
    let contactIdsStr = existingTransaction.contactIds;
    if (contactIds !== undefined) {
      contactIdsStr = Array.isArray(contactIds) && contactIds.length > 0
        ? stringifyContactIds(contactIds)
        : null;
    }

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
        placeId,
        contactIds: contactIdsStr,
      })
      .where(eq(financeTransactions.id, id));

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
        place: true,
      },
    });

    // Enrich with contacts
    const enrichedTransaction = await enrichTransaction(transaction);

    return NextResponse.json(enrichedTransaction);
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
