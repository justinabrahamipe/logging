import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const maxDuration = 10;
export const dynamic = 'force-dynamic';

// GET /api/finance/categories - Get all categories for user
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const categories = await prisma.financeCategory.findMany({
      where: { userId: session.user.id },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ data: categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

// POST /api/finance/categories - Create new category
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
    const { name, type, description, color, icon } = body;

    // Validate required fields
    if (!name || !type) {
      return NextResponse.json(
        { error: "Name and type are required" },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ["income", "expense"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: "Invalid category type" },
        { status: 400 }
      );
    }

    const category = await prisma.financeCategory.create({
      data: {
        userId: session.user.id,
        name,
        type,
        description: description || null,
        color: color || null,
        icon: icon || null,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }
}

// PUT /api/finance/categories - Update category
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
    const { id, name, type, description, color, icon } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Category ID is required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingCategory = await prisma.financeCategory.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existingCategory) {
      return NextResponse.json(
        { error: "Category not found or unauthorized" },
        { status: 404 }
      );
    }

    // Validate type if provided
    if (type) {
      const validTypes = ["income", "expense"];
      if (!validTypes.includes(type)) {
        return NextResponse.json(
          { error: "Invalid category type" },
          { status: 400 }
        );
      }
    }

    const category = await prisma.financeCategory.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(description !== undefined && { description }),
        ...(color !== undefined && { color }),
        ...(icon !== undefined && { icon }),
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error("Error updating category:", error);
    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 }
    );
  }
}

// DELETE /api/finance/categories - Delete category
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
        { error: "Category ID is required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingCategory = await prisma.financeCategory.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    });

    if (!existingCategory) {
      return NextResponse.json(
        { error: "Category not found or unauthorized" },
        { status: 404 }
      );
    }

    await prisma.financeCategory.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Error deleting category:", error);
    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 }
    );
  }
}
