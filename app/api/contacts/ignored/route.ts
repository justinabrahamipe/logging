import { NextRequest, NextResponse } from "next/server";
import { db, contacts } from "@/lib/db";
import { auth } from "@/auth";
import { eq, and, desc } from "drizzle-orm";

export const maxDuration = 10;
export const dynamic = 'force-dynamic';

// GET - List all ignored contacts
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
      .from(contacts)
      .where(and(
        eq(contacts.userId, session.user.id),
        eq(contacts.isIgnored, true)
      ))
      .orderBy(desc(contacts.createdAt));

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

// POST - Ignore a contact (set isIgnored = true)
export async function POST(request: NextRequest) {
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

    // Set isIgnored = true
    const updated = await db.update(contacts)
      .set({ isIgnored: true, updatedAt: new Date() })
      .where(and(
        eq(contacts.id, body.id),
        eq(contacts.userId, session.user.id)
      ))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Contact ignored"
    }, { status: 200 });
  } catch (error) {
    console.error("POST /api/contacts/ignored error:", error);
    return NextResponse.json({
      success: false,
      message: "Failed to ignore contact"
    }, { status: 500 });
  }
}

// DELETE - Restore an ignored contact (set isIgnored = false)
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

    // Set isIgnored = false
    const updated = await db.update(contacts)
      .set({ isIgnored: false, updatedAt: new Date() })
      .where(and(
        eq(contacts.id, body.id),
        eq(contacts.userId, session.user.id)
      ))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Contact restored"
    }, { status: 200 });
  } catch (error) {
    console.error("DELETE /api/contacts/ignored error:", error);
    return NextResponse.json({
      success: false,
      message: "Failed to restore contact"
    }, { status: 500 });
  }
}
