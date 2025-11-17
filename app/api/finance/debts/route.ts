import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, financeDebts } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";

export const maxDuration = 10;
export const dynamic = 'force-dynamic';

// GET /api/finance/debts - Get all debts for user
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const debts = await db.query.financeDebts.findMany({
      where: eq(financeDebts.userId, session.user.id),
      with: {
        contact: {
          columns: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
      orderBy: [desc(financeDebts.createdAt)],
    });

    return NextResponse.json({ data: debts });
  } catch (error) {
    console.error("Error fetching debts:", error);
    return NextResponse.json(
      { error: "Failed to fetch debts" },
      { status: 500 }
    );
  }
}

// POST /api/finance/debts - Create new debt
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
      name,
      type,
      amount,
      remainingAmount,
      currency,
      interestRate,
      contactId,
      description,
      dueDate,
      startDate,
      status
    } = body;

    // Validate required fields
    if (!name || !type || amount === undefined || remainingAmount === undefined || !currency) {
      return NextResponse.json(
        { error: "Name, type, amount, remaining amount, and currency are required" },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ["debt", "loan"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: "Invalid debt type" },
        { status: 400 }
      );
    }

    const [debt] = await db.insert(financeDebts).values({
      userId: session.user.id,
      name,
      type,
      amount,
      remainingAmount,
      currency,
      interestRate: interestRate || null,
      contactId: contactId || null,
      description: description || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      startDate: startDate ? new Date(startDate) : new Date(),
      status: status || "active",
    }).returning();

    return NextResponse.json(debt, { status: 201 });
  } catch (error) {
    console.error("Error creating debt:", error);
    return NextResponse.json(
      { error: "Failed to create debt" },
      { status: 500 }
    );
  }
}

// PUT /api/finance/debts - Update debt
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
      name,
      type,
      amount,
      remainingAmount,
      currency,
      interestRate,
      contactId,
      description,
      dueDate,
      startDate,
      status
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Debt ID is required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingDebt = await db.query.financeDebts.findFirst({
      where: and(
        eq(financeDebts.id, id),
        eq(financeDebts.userId, session.user.id)
      )
    });

    if (!existingDebt) {
      return NextResponse.json(
        { error: "Debt not found or unauthorized" },
        { status: 404 }
      );
    }

    // Validate type if provided
    if (type) {
      const validTypes = ["debt", "loan"];
      if (!validTypes.includes(type)) {
        return NextResponse.json(
          { error: "Invalid debt type" },
          { status: 400 }
        );
      }
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (type) updateData.type = type;
    if (amount !== undefined) updateData.amount = amount;
    if (remainingAmount !== undefined) updateData.remainingAmount = remainingAmount;
    if (currency) updateData.currency = currency;
    if (interestRate !== undefined) updateData.interestRate = interestRate;
    if (contactId !== undefined) updateData.contactId = contactId;
    if (description !== undefined) updateData.description = description;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (startDate) updateData.startDate = new Date(startDate);
    if (status) updateData.status = status;

    const [debt] = await db.update(financeDebts)
      .set(updateData)
      .where(eq(financeDebts.id, id))
      .returning();

    return NextResponse.json(debt);
  } catch (error) {
    console.error("Error updating debt:", error);
    return NextResponse.json(
      { error: "Failed to update debt" },
      { status: 500 }
    );
  }
}

// DELETE /api/finance/debts - Delete debt
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
        { error: "Debt ID is required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingDebt = await db.query.financeDebts.findFirst({
      where: and(
        eq(financeDebts.id, parseInt(id)),
        eq(financeDebts.userId, session.user.id)
      )
    });

    if (!existingDebt) {
      return NextResponse.json(
        { error: "Debt not found or unauthorized" },
        { status: 404 }
      );
    }

    await db.delete(financeDebts)
      .where(eq(financeDebts.id, parseInt(id)));

    return NextResponse.json({ message: "Debt deleted successfully" });
  } catch (error) {
    console.error("Error deleting debt:", error);
    return NextResponse.json(
      { error: "Failed to delete debt" },
      { status: 500 }
    );
  }
}
