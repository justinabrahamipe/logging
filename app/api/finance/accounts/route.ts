import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, financeAccounts } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";

export const maxDuration = 10;
export const dynamic = 'force-dynamic';

// GET /api/finance/accounts - Get all accounts for user
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const accounts = await db.select()
      .from(financeAccounts)
      .where(eq(financeAccounts.userId, session.user.id))
      .orderBy(desc(financeAccounts.createdAt));

    return NextResponse.json({ data: accounts });
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}

// POST /api/finance/accounts - Create new account
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
    const { name, currency, type, balance, description } = body;

    // Validate required fields
    if (!name || !currency || !type) {
      return NextResponse.json(
        { error: "Name, currency, and type are required" },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ["credit_card", "bank", "cash", "investment", "other"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: "Invalid account type" },
        { status: 400 }
      );
    }

    const [account] = await db.insert(financeAccounts).values({
      userId: session.user.id,
      name,
      currency,
      type,
      balance: balance || 0,
      description: description || null,
    }).returning();

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    console.error("Error creating account:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}

// PUT /api/finance/accounts - Update account
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
    const { id, name, currency, type, balance, description } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Account ID is required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingAccount = await db.query.financeAccounts.findFirst({
      where: and(
        eq(financeAccounts.id, id),
        eq(financeAccounts.userId, session.user.id)
      )
    });

    if (!existingAccount) {
      return NextResponse.json(
        { error: "Account not found or unauthorized" },
        { status: 404 }
      );
    }

    // Validate type if provided
    if (type) {
      const validTypes = ["credit_card", "bank", "cash", "investment", "other"];
      if (!validTypes.includes(type)) {
        return NextResponse.json(
          { error: "Invalid account type" },
          { status: 400 }
        );
      }
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (currency) updateData.currency = currency;
    if (type) updateData.type = type;
    if (typeof balance === "number") updateData.balance = balance;
    if (description !== undefined) updateData.description = description;

    const [account] = await db.update(financeAccounts)
      .set(updateData)
      .where(eq(financeAccounts.id, id))
      .returning();

    return NextResponse.json(account);
  } catch (error) {
    console.error("Error updating account:", error);
    return NextResponse.json(
      { error: "Failed to update account" },
      { status: 500 }
    );
  }
}

// DELETE /api/finance/accounts - Delete account
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
        { error: "Account ID is required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingAccount = await db.query.financeAccounts.findFirst({
      where: and(
        eq(financeAccounts.id, parseInt(id)),
        eq(financeAccounts.userId, session.user.id)
      )
    });

    if (!existingAccount) {
      return NextResponse.json(
        { error: "Account not found or unauthorized" },
        { status: 404 }
      );
    }

    await db.delete(financeAccounts)
      .where(eq(financeAccounts.id, parseInt(id)));

    return NextResponse.json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
