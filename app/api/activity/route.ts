import { NextRequest, NextResponse } from "next/server";
import { db, activities } from "@/lib/db";
import { desc, eq } from "drizzle-orm";

export const maxDuration = 10;
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await db.select().from(activities).orderBy(desc(activities.createdOn));
    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error("GET /api/activity error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.title || !body.category || !body.icon) {
      return NextResponse.json(
        { error: "Missing required fields: title, category, and icon are required" },
        { status: 400 }
      );
    }

    const [response] = await db.insert(activities).values({
      title: body.title,
      category: body.category,
      icon: body.icon,
      color: body.color || null
    }).returning();
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("POST /api/activity error:", error);
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
    const { oldTitle, ...body } = await request.json();

    if (!oldTitle) {
      return NextResponse.json(
        { error: "oldTitle is required for updates" },
        { status: 400 }
      );
    }

    const updated = await db.update(activities)
      .set({
        title: body.title,
        category: body.category,
        icon: body.icon,
        color: body.color || null
      })
      .where(eq(activities.title, oldTitle))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json(
        { error: "Activity not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ count: updated.length }, { status: 200 });
  } catch (error) {
    console.error("PUT /api/activity error:", error);
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
    const body = await request.json();

    if (!body.title) {
      return NextResponse.json(
        { error: "title is required for deletion" },
        { status: 400 }
      );
    }

    const deleted = await db.delete(activities)
      .where(eq(activities.title, body.title))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: "Activity not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ count: deleted.length }, { status: 200 });
  } catch (error) {
    console.error("DELETE /api/activity error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      },
      { status: 500 }
    );
  }
}
