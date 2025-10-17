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
    const search = searchParams.get('search') || '';

    // Build where clause with search
    const whereClause: any = {
      userId: session.user.id
    };

    if (search.trim()) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get total count
    const totalCount = await prisma.contact.count({
      where: whereClause
    });

    const contacts = await prisma.contact.findMany({
      where: whereClause,
      orderBy: {
        name: 'asc'
      },
      take: limit,
      skip: offset
    });

    return NextResponse.json({
      data: contacts,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + contacts.length < totalCount
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

    const contact = await prisma.contact.create({
      data: {
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
      },
    });

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
    const existingContact = await prisma.contact.findFirst({
      where: {
        id: body.id,
        userId: session.user.id
      }
    });

    if (!existingContact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    const contact = await prisma.contact.update({
      where: {
        id: body.id,
      },
      data: {
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
      },
    });

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
    const contact = await prisma.contact.findFirst({
      where: {
        id: body.id,
        userId: session.user.id
      }
    });

    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    // If contact has a googleId, add it to ignored list
    if (contact.googleId) {
      await prisma.ignoredContact.upsert({
        where: {
          userId_googleId: {
            userId: session.user.id,
            googleId: contact.googleId
          }
        },
        update: {},
        create: {
          userId: session.user.id,
          googleId: contact.googleId,
          name: contact.name
        }
      });
    }

    // Delete the contact
    const response = await prisma.contact.deleteMany({
      where: {
        id: body.id,
        userId: session.user.id
      },
    });

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
