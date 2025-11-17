import { NextRequest, NextResponse } from "next/server";
import { db, contacts, ignoredContacts } from "@/lib/db";
import { auth } from "@/auth";
import { eq, and, or, like, asc } from "drizzle-orm";

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
    const search = searchParams.get('search') || '';

    // Build where clause with search
    let whereClause = eq(contacts.userId, session.user.id);

    if (search.trim()) {
      whereClause = and(
        eq(contacts.userId, session.user.id),
        or(
          like(contacts.name, `%${search}%`),
          like(contacts.email, `%${search}%`),
          like(contacts.phoneNumber, `%${search}%`),
          like(contacts.address, `%${search}%`)
        )
      ) as any;
    }

    // Get all contacts with filter
    const allContacts = await db.select().from(contacts).where(whereClause).orderBy(asc(contacts.name));
    const totalCount = allContacts.length;

    // Apply pagination
    const paginatedContacts = allContacts.slice(offset, offset + limit);

    return NextResponse.json({
      data: paginatedContacts,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + paginatedContacts.length < totalCount
      }
    }, { status: 200 });
  } catch (error) {
    console.error("GET /api/contacts error:", error);
    // Return empty data instead of error to prevent client-side crashes
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

    if (!body.name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const [contact] = await db.insert(contacts).values({
      userId: session.user.id,
      name: body.name,
      email: body.email || null,
      phoneNumber: body.phoneNumber || null,
      address: body.address || null,
      birthday: body.birthday ? new Date(body.birthday) : null,
      weddingAnniversary: body.weddingAnniversary ? new Date(body.weddingAnniversary) : null,
      notes: body.notes || null,
      photoUrl: body.photoUrl || null,
      organization: body.organization || null,
      jobTitle: body.jobTitle || null,
    }).returning();

    return NextResponse.json({ data: contact }, { status: 201 });
  } catch (error) {
    console.error("POST /api/contacts error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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

    if (!body.name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Check if contact exists and belongs to user
    const existingContact = await db.query.contacts.findFirst({
      where: and(
        eq(contacts.id, body.id),
        eq(contacts.userId, session.user.id)
      )
    });

    if (!existingContact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    const [contact] = await db.update(contacts)
      .set({
        name: body.name,
        email: body.email || null,
        phoneNumber: body.phoneNumber || null,
        address: body.address || null,
        birthday: body.birthday ? new Date(body.birthday) : null,
        weddingAnniversary: body.weddingAnniversary ? new Date(body.weddingAnniversary) : null,
        notes: body.notes || null,
        photoUrl: body.photoUrl || null,
        organization: body.organization || null,
        jobTitle: body.jobTitle || null,
        updatedAt: new Date()
      })
      .where(eq(contacts.id, body.id))
      .returning();

    return NextResponse.json({ data: contact }, { status: 200 });
  } catch (error) {
    console.error("PUT /api/contacts error:", error);
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

    // Find the contact first to get googleId
    const contact = await db.query.contacts.findFirst({
      where: and(
        eq(contacts.id, body.id),
        eq(contacts.userId, session.user.id)
      )
    });

    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    // If contact has a googleId, add it to ignored list
    if (contact.googleId) {
      // Check if ignored contact already exists
      const existingIgnored = await db.query.ignoredContacts.findFirst({
        where: and(
          eq(ignoredContacts.userId, session.user.id),
          eq(ignoredContacts.googleId, contact.googleId)
        )
      });

      if (!existingIgnored) {
        // Create new ignored contact
        await db.insert(ignoredContacts).values({
          userId: session.user.id,
          googleId: contact.googleId,
          name: contact.name
        });
      }
    }

    // Delete the contact
    const deleted = await db.delete(contacts)
      .where(and(
        eq(contacts.id, body.id),
        eq(contacts.userId, session.user.id)
      ))
      .returning();

    return NextResponse.json({ count: deleted.length }, { status: 200 });
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
