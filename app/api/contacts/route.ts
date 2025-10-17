import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const maxDuration = 10;
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const contacts = await prisma.contact.findMany({
      where: {
        userId: session.user.id
      },
      orderBy: {
        name: 'asc'
      }
    });

    return NextResponse.json({ data: contacts }, { status: 200 });
  } catch (error) {
    console.error("GET /api/contacts error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "Contact ID is required" },
        { status: 400 }
      );
    }

    const response = await prisma.contact.deleteMany({
      where: {
        id: body.id,
        userId: session.user.id // Ensure user can only delete their own contacts
      },
    });

    if (response.count === 0) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("DELETE /api/contacts error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      },
      { status: 500 }
    );
  }
}
