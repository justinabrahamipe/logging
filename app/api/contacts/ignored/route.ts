import { NextRequest, NextResponse } from "next/server";
import { db, ignoredContacts } from "@/lib/db";
import { auth } from "@/auth";
import { eq, and, desc } from "drizzle-orm";

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

    // Get all ignored contacts
    const allIgnored = await db.select()
      .from(ignoredContacts)
      .where(eq(ignoredContacts.userId, session.user.id))
      .orderBy(desc(ignoredContacts.createdAt));

    const totalCount = allIgnored.length;

    // Apply pagination
    const paginatedIgnored = allIgnored.slice(offset, offset + limit);

    return NextResponse.json({
      data: paginatedIgnored,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + paginatedIgnored.length < totalCount
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
    const deleted = await db.delete(ignoredContacts)
      .where(and(
        eq(ignoredContacts.googleId, body.googleId),
        eq(ignoredContacts.userId, session.user.id)
      ))
      .returning();

    if (deleted.length === 0) {
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
