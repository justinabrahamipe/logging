import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const data = await prisma.log.findMany({
      orderBy: {
        created_on: 'desc'
      }
    });
    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    console.error("GET /api/log error:", error);
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
    console.log("POST /api/log body:", body);

    // Validate required fields
    if (!body.activityTitle || !body.activityCategory || !body.activityIcon) {
      return NextResponse.json(
        { error: "Missing required fields: activityTitle, activityCategory, and activityIcon are required" },
        { status: 400 }
      );
    }

    const response = await prisma.log.create({
      data: {
        activityTitle: body.activityTitle,
        activityCategory: body.activityCategory,
        activityIcon: body.activityIcon,
        activityColor: body.activityColor || null,
        start_time: body.start_time ? new Date(body.start_time) : new Date(),
        end_time: body.end_time ? new Date(body.end_time) : null,
        comment: body.comment || null,
        time_spent: body.time_spent || null
      }
    });
    console.log("Created log:", response);
    return NextResponse.json(response, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/log error:", error);
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
    const { id, ...body } = await request.json();
    console.log("PUT /api/log id:", id, "body:", body);

    if (!id) {
      return NextResponse.json(
        { error: "id is required for updates" },
        { status: 400 }
      );
    }

    const updateData: {
      end_time?: Date | null;
      comment?: string | null;
      time_spent?: number | null;
    } = {};
    if (body.end_time !== undefined) updateData.end_time = body.end_time ? new Date(body.end_time) : null;
    if (body.comment !== undefined) updateData.comment = body.comment;
    if (body.time_spent !== undefined) updateData.time_spent = body.time_spent;

    const response = await prisma.log.update({
      where: { id: parseInt(id) },
      data: updateData,
    });
    console.log("Updated log:", response);
    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    console.error("PUT /api/log error:", error);
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
    const response = await prisma.log.deleteMany({
      where: { id: body.id },
    });
    return NextResponse.json(response);
  } catch (error: unknown) {
    return NextResponse.json({
      error:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
}
