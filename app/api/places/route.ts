import { NextRequest, NextResponse } from "next/server";
import { db, places } from "@/lib/db";
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
    const category = searchParams.get('category') || '';

    // Build where clause with search and filters
    const whereConditions: any[] = [eq(places.userId, session.user.id)];

    if (search.trim()) {
      whereConditions.push(
        or(
          like(places.name, `%${search}%`),
          like(places.address, `%${search}%`),
          like(places.description, `%${search}%`)
        )
      );
    }

    if (category.trim()) {
      whereConditions.push(eq(places.category, category));
    }

    // Get total count
    const allPlaces = await db.select().from(places).where(and(...whereConditions));
    const totalCount = allPlaces.length;

    const placesData = await db.query.places.findMany({
      where: and(...whereConditions),
      orderBy: [asc(places.name)],
      limit: limit,
      offset: offset,
    });

    return NextResponse.json({
      data: placesData,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + placesData.length < totalCount
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

    const [place] = await db.insert(places).values({
      userId: session.user.id,
      name: body.name,
      address: body.address,
      latitude: body.latitude || null,
      longitude: body.longitude || null,
      description: body.description || null,
      category: body.category || null,
    }).returning();

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
    const existingPlace = await db.query.places.findFirst({
      where: and(
        eq(places.id, body.id),
        eq(places.userId, session.user.id)
      )
    });

    if (!existingPlace) {
      return NextResponse.json(
        { error: "Place not found" },
        { status: 404 }
      );
    }

    // Update the place
    const [updatedPlace] = await db.update(places)
      .set({
        name: body.name,
        address: body.address,
        latitude: body.latitude || null,
        longitude: body.longitude || null,
        description: body.description || null,
        category: body.category || null,
        updatedAt: new Date()
      })
      .where(eq(places.id, body.id))
      .returning();

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

    // Delete the places
    const response = await db.delete(places)
      .where(
        and(
          eq(places.userId, session.user.id),
          ids.length === 1 ? eq(places.id, ids[0]) : or(...ids.map((id: number) => eq(places.id, id)))
        )
      )
      .returning();

    return NextResponse.json({
      count: response.length,
      message: `Successfully deleted ${response.length} place${response.length !== 1 ? 's' : ''}`
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
