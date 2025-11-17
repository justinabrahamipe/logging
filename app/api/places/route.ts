import { NextRequest, NextResponse } from "next/server";
import { createManyIgnoreDuplicates } from "@/lib/prisma-utils";
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
    const category = searchParams.get('category') || '';

    // Build where clause with search and filters
    const whereClause: any = {
      userId: session.user.id
    };

    if (search.trim()) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (category.trim()) {
      whereClause.category = category;
    }

    // Get total count
    const totalCount = await prisma.place.count({
      where: whereClause
    });

    const places = await prisma.place.findMany({
      where: whereClause,
      include: {
        placeContacts: {
          include: {
            contact: {
              select: {
                id: true,
                name: true,
                photoUrl: true
              }
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      },
      take: limit,
      skip: offset
    });

    return NextResponse.json({
      data: places,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + places.length < totalCount
      }
    }, { status: 200 });
  } catch (error) {
    console.error("GET /api/places error:", error);
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

    if (!body.address) {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    const place = await prisma.place.create({
      data: {
        userId: session.user.id,
        name: body.name,
        address: body.address,
        latitude: body.latitude || null,
        longitude: body.longitude || null,
        description: body.description || null,
        category: body.category || null,
      },
      include: {
        placeContacts: {
          include: {
            contact: {
              select: {
                id: true,
                name: true,
                photoUrl: true
              }
            }
          }
        }
      }
    });

    // Link contacts if provided
    if (body.contactIds && Array.isArray(body.contactIds) && body.contactIds.length > 0) {
      await createManyIgnoreDuplicates(
        prisma.placeContact,
        body.contactIds.map((contactId: number) => ({
          placeId: place.id,
          contactId
        }))
      );

      // Fetch updated place with contacts
      const updatedPlace = await prisma.place.findUnique({
        where: { id: place.id },
        include: {
          placeContacts: {
            include: {
              contact: {
                select: {
                  id: true,
                  name: true,
                  photoUrl: true
                }
              }
            }
          }
        }
      });

      return NextResponse.json({ data: updatedPlace }, { status: 201 });
    }

    return NextResponse.json({ data: place }, { status: 201 });
  } catch (error) {
    console.error("POST /api/places error:", error);
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
        { error: "Place ID is required" },
        { status: 400 }
      );
    }

    if (!body.name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    if (!body.address) {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    // Check if place exists and belongs to user
    const existingPlace = await prisma.place.findFirst({
      where: {
        id: body.id,
        userId: session.user.id
      }
    });

    if (!existingPlace) {
      return NextResponse.json(
        { error: "Place not found" },
        { status: 404 }
      );
    }

    // Update the place
    const place = await prisma.place.update({
      where: {
        id: body.id,
      },
      data: {
        name: body.name,
        address: body.address,
        latitude: body.latitude || null,
        longitude: body.longitude || null,
        description: body.description || null,
        category: body.category || null,
        updatedAt: new Date()
      },
    });

    // Update contacts if provided
    if (body.contactIds !== undefined && Array.isArray(body.contactIds)) {
      // Remove all existing contacts
      await prisma.placeContact.deleteMany({
        where: { placeId: body.id }
      });

      // Add new contacts
      if (body.contactIds.length > 0) {
        await createManyIgnoreDuplicates(
          prisma.placeContact,
          body.contactIds.map((contactId: number) => ({
            placeId: body.id,
            contactId
          }))
        );
      }
    }

    // Fetch updated place with contacts
    const updatedPlace = await prisma.place.findUnique({
      where: { id: body.id },
      include: {
        placeContacts: {
          include: {
            contact: {
              select: {
                id: true,
                name: true,
                photoUrl: true
              }
            }
          }
        }
      }
    });

    return NextResponse.json({ data: updatedPlace }, { status: 200 });
  } catch (error) {
    console.error("PUT /api/places error:", error);
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

    // Support both single ID and array of IDs
    const ids = Array.isArray(body.ids) ? body.ids : (body.id ? [body.id] : []);

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "Place ID(s) are required" },
        { status: 400 }
      );
    }

    // Delete the places (cascade will handle placeContacts)
    const response = await prisma.place.deleteMany({
      where: {
        id: { in: ids },
        userId: session.user.id
      },
    });

    return NextResponse.json({
      count: response.count,
      message: `Successfully deleted ${response.count} place${response.count !== 1 ? 's' : ''}`
    }, { status: 200 });
  } catch (error) {
    console.error("DELETE /api/places error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      },
      { status: 500 }
    );
  }
}
