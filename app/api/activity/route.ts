import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const client = new PrismaClient();

export async function GET() {
  try {
    const data = await client.activity.findMany({
      orderBy: {
        created_on: 'desc'
      }
    });
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

    const response = await client.activity.create({
      data: {
        title: body.title,
        category: body.category,
        icon: body.icon,
        color: body.color || null
      }
    });
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

    const response = await client.activity.updateMany({
      where: { title: oldTitle },
      data: {
        title: body.title,
        category: body.category,
        icon: body.icon,
        color: body.color || null
      },
    });

    if (response.count === 0) {
      return NextResponse.json(
        { error: "Activity not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(response, { status: 200 });
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

    const response = await client.activity.deleteMany({
      where: { title: body.title },
    });

    if (response.count === 0) {
      return NextResponse.json(
        { error: "Activity not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(response, { status: 200 });
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
