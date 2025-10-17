import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const maxDuration = 10;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get total count
    const totalCount = await prisma.ignoredContact.count({
      where: {
        userId: session.user.id
      }
    });

    const ignoredContacts = await prisma.ignoredContact.findMany({
      where: {
        userId: session.user.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset
    });

    return NextResponse.json({
      data: ignoredContacts,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + ignoredContacts.length < totalCount
      }
    }, { status: 200 });
  } catch (error) {
    console.error("GET /api/contacts/ignored error:", error);
    return NextResponse.json({
      data: [],
      pagination: {
        total: 0,
        limit: 50,
        offset: 0,
        hasMore: false
      }
    }, { status: 200 });
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

    if (!body.googleId) {
      return NextResponse.json(
        { error: "Google ID is required" },
        { status: 400 }
      );
    }

    // Remove from ignored list (restore)
    const response = await prisma.ignoredContact.deleteMany({
      where: {
        googleId: body.googleId,
        userId: session.user.id
      },
    });

    if (response.count === 0) {
      return NextResponse.json(
        { error: "Ignored contact not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Contact restored - will reappear on next sync"
    }, { status: 200 });
  } catch (error) {
    console.error("DELETE /api/contacts/ignored error:", error);
    return NextResponse.json({
      success: false,
      message: "Failed to restore contact"
    }, { status: 200 });
  }
}
