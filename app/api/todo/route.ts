import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

// Prevent multiple instances in development
const globalForPrisma = global as unknown as { prisma: PrismaClient };

const client = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;

export async function GET() {
  try {
    const data = await client.todo.findMany();
    console.log("data", data);
    return NextResponse.json({ data });
  } catch (error: unknown) {
    return NextResponse.json({
      error:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
}

export async function POST(request: NextRequest) {
  console.log("POST /api/todo called");

  try {
    const body = await request.json();
    console.log("POST body received:", JSON.stringify(body, null, 2));

    // Ensure required fields and defaults
    const todoData = {
      title: body.title?.trim() || "",
      description: body.description?.trim() || null,
      activityTitle: body.activityTitle?.trim() || null,
      activityCategory: body.activityCategory?.trim() || null,
      deadline: body.deadline || null,
      work_date: body.work_date || null,
      importance: Number(body.importance) || 1,
      urgency: Number(body.urgency) || 1,
      done: Boolean(body.done),
    };

    console.log("Processed todoData:", JSON.stringify(todoData, null, 2));

    if (!todoData.title || todoData.title.trim() === "") {
      console.error("Title validation failed");
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    console.log("Creating todo in database...");
    const response = await client.todo.create({ data: todoData });
    console.log("Todo created successfully:", response);

    return NextResponse.json(response, { status: 201 });
  } catch (error: unknown) {
    console.error("POST error details:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "An unknown error occurred",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("PUT body", body);

    if (!body.id) {
      return NextResponse.json(
        { error: "ID is required for update" },
        { status: 400 }
      );
    }

    const { id, ...updateData } = body;
    const response = await client.todo.update({
      where: { id: Number(id) },
      data: updateData,
    });
    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error("PUT error:", error);
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
    const response = await client.todo.deleteMany({
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
