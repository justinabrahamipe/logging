import { NextRequest, NextResponse } from "next/server";
import { createManyIgnoreDuplicates } from "@/lib/prisma-utils";
import { prisma } from "@/lib/prisma";

export const maxDuration = 10;
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await prisma.todo.findMany({
      include: {
        todoContacts: {
          include: {
            contact: {
              select: {
                id: true,
                name: true,
                photoUrl: true
              }
            }
          }
        },
        todoPlaces: {
          include: {
            place: {
              select: {
                id: true,
                name: true,
                address: true
              }
            }
          }
        }
      },
      orderBy: [
        { done: 'asc' },        // Show incomplete todos first
        { created_on: 'desc' }  // Then sort by newest
      ]
    });
    console.log("data", data);
    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    console.error("GET /api/todo error:", error);
    return NextResponse.json({
      error:
        error instanceof Error ? error.message : "An unknown error occurred",
    }, { status: 500 });
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
    const todo = await prisma.todo.create({ data: todoData });
    console.log("Todo created successfully:", todo);

    // Link contacts if provided
    if (body.contactIds && Array.isArray(body.contactIds) && body.contactIds.length > 0) {
      await createManyIgnoreDuplicates(
        prisma.todoContact,
        body.contactIds.map((contactId: number) => ({
          todoId: todo.id,
          contactId
        }))
      );
    }

    // Link places if provided
    if (body.placeIds && Array.isArray(body.placeIds) && body.placeIds.length > 0) {
      await createManyIgnoreDuplicates(
        prisma.todoPlace,
        body.placeIds.map((placeId: number) => ({
          todoId: todo.id,
          placeId
        }))
      );
    }

    // Fetch the complete todo with relationships
    const response = await prisma.todo.findUnique({
      where: { id: todo.id },
      include: {
        todoContacts: {
          include: {
            contact: {
              select: {
                id: true,
                name: true,
                photoUrl: true
              }
            }
          }
        },
        todoPlaces: {
          include: {
            place: {
              select: {
                id: true,
                name: true,
                address: true
              }
            }
          }
        }
      }
    });

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

    const { id, contactIds, placeIds, ...updateData } = body;

    await prisma.todo.update({
      where: { id: Number(id) },
      data: updateData,
    });

    // Update contacts if provided
    if (contactIds !== undefined && Array.isArray(contactIds)) {
      // Remove all existing contacts
      await prisma.todoContact.deleteMany({
        where: { todoId: Number(id) }
      });

      // Add new contacts
      if (contactIds.length > 0) {
        await createManyIgnoreDuplicates(
          prisma.todoContact,
          contactIds.map((contactId: number) => ({
            todoId: Number(id),
            contactId
          }))
        );
      }
    }

    // Update places if provided
    if (placeIds !== undefined && Array.isArray(placeIds)) {
      // Remove all existing places
      await prisma.todoPlace.deleteMany({
        where: { todoId: Number(id) }
      });

      // Add new places
      if (placeIds.length > 0) {
        await createManyIgnoreDuplicates(
          prisma.todoPlace,
          placeIds.map((placeId: number) => ({
            todoId: Number(id),
            placeId
          }))
        );
      }
    }

    // Fetch the updated todo with relationships
    const response = await prisma.todo.findUnique({
      where: { id: Number(id) },
      include: {
        todoContacts: {
          include: {
            contact: {
              select: {
                id: true,
                name: true,
                photoUrl: true
              }
            }
          }
        },
        todoPlaces: {
          include: {
            place: {
              select: {
                id: true,
                name: true,
                address: true
              }
            }
          }
        }
      }
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
    const response = await prisma.todo.deleteMany({
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
