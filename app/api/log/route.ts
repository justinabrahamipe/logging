import { NextRequest, NextResponse } from "next/server";
import { insertManyIgnoreDuplicates } from "@/lib/drizzle-utils";
import { db, logs, todos, goals, contacts, places, logContacts, logPlaces } from "@/lib/db";
import { desc, eq } from "drizzle-orm";

export const maxDuration = 10;
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await db.query.logs.findMany({
      orderBy: [desc(logs.createdOn)],
      with: {
        todo: {
          columns: {
            id: true,
            title: true,
            done: true
          }
        },
        goal: {
          columns: {
            id: true,
            title: true,
            goalType: true
          }
        },
        logContacts: {
          with: {
            contact: {
              columns: {
                id: true,
                name: true,
                photoUrl: true
              }
            }
          }
        },
        logPlaces: {
          with: {
            place: {
              columns: {
                id: true,
                name: true,
                address: true
              }
            }
          }
        }
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

    const [log] = await db.insert(logs).values({
      activityTitle: body.activityTitle,
      activityCategory: body.activityCategory,
      activityIcon: body.activityIcon,
      activityColor: body.activityColor || null,
      startTime: body.start_time ? new Date(body.start_time) : new Date(),
      endTime: body.end_time ? new Date(body.end_time) : null,
      comment: body.comment || null,
      timeSpent: body.time_spent || null,
      todoId: body.todoId ? parseInt(body.todoId) : null,
      goalId: body.goalId ? parseInt(body.goalId) : null,
      goalCount: body.goalCount ? parseInt(body.goalCount) : null,
      userId: body.userId || null
    }).returning();

    // Link contacts if provided
    if (body.contactIds && Array.isArray(body.contactIds) && body.contactIds.length > 0) {
      await insertManyIgnoreDuplicates(
        logContacts,
        body.contactIds.map((contactId: number) => ({
          logId: log.id,
          contactId
        }))
      );
    }

    // Link places if provided
    if (body.placeIds && Array.isArray(body.placeIds) && body.placeIds.length > 0) {
      await insertManyIgnoreDuplicates(
        logPlaces,
        body.placeIds.map((placeId: number) => ({
          logId: log.id,
          placeId
        }))
      );
    }

    // Fetch the complete log with relationships
    const response = await db.query.logs.findFirst({
      where: eq(logs.id, log.id),
      with: {
        todo: {
          columns: {
            id: true,
            title: true,
            done: true
          }
        },
        goal: {
          columns: {
            id: true,
            title: true,
            goalType: true
          }
        },
        logContacts: {
          with: {
            contact: {
              columns: {
                id: true,
                name: true,
                photoUrl: true
              }
            }
          }
        },
        logPlaces: {
          with: {
            place: {
              columns: {
                id: true,
                name: true,
                address: true
              }
            }
          }
        }
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

    const updateData: any = {};
    if (body.end_time !== undefined) updateData.endTime = body.end_time ? new Date(body.end_time) : null;
    if (body.comment !== undefined) updateData.comment = body.comment;
    if (body.time_spent !== undefined) updateData.timeSpent = body.time_spent;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.activityTitle !== undefined) updateData.activityTitle = body.activityTitle;
    if (body.activityCategory !== undefined) updateData.activityCategory = body.activityCategory;
    if (body.activityIcon !== undefined) updateData.activityIcon = body.activityIcon;
    if (body.activityColor !== undefined) updateData.activityColor = body.activityColor;
    if (body.start_time !== undefined) updateData.startTime = new Date(body.start_time);
    if (body.todoId !== undefined) updateData.todoId = body.todoId ? parseInt(body.todoId) : null;
    if (body.goalId !== undefined) updateData.goalId = body.goalId ? parseInt(body.goalId) : null;
    if (body.goalCount !== undefined) updateData.goalCount = body.goalCount ? parseInt(body.goalCount) : null;

    await db.update(logs)
      .set(updateData)
      .where(eq(logs.id, parseInt(id)));

    // Update contacts if provided
    if (body.contactIds !== undefined && Array.isArray(body.contactIds)) {
      // Remove all existing contacts
      await db.delete(logContacts).where(eq(logContacts.logId, parseInt(id)));

      // Add new contacts
      if (body.contactIds.length > 0) {
        await insertManyIgnoreDuplicates(
          logContacts,
          body.contactIds.map((contactId: number) => ({
            logId: parseInt(id),
            contactId
          }))
        );
      }
    }

    // Update places if provided
    if (body.placeIds !== undefined && Array.isArray(body.placeIds)) {
      // Remove all existing places
      await db.delete(logPlaces).where(eq(logPlaces.logId, parseInt(id)));

      // Add new places
      if (body.placeIds.length > 0) {
        await insertManyIgnoreDuplicates(
          logPlaces,
          body.placeIds.map((placeId: number) => ({
            logId: parseInt(id),
            placeId
          }))
        );
      }
    }

    // Fetch the updated log with relationships
    const response = await db.query.logs.findFirst({
      where: eq(logs.id, parseInt(id)),
      with: {
        todo: {
          columns: {
            id: true,
            title: true,
            done: true
          }
        },
        goal: {
          columns: {
            id: true,
            title: true,
            goalType: true
          }
        },
        logContacts: {
          with: {
            contact: {
              columns: {
                id: true,
                name: true,
                photoUrl: true
              }
            }
          }
        },
        logPlaces: {
          with: {
            place: {
              columns: {
                id: true,
                name: true,
                address: true
              }
            }
          }
        }
      }
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
    const deleted = await db.delete(logs)
      .where(eq(logs.id, body.id))
      .returning();
    return NextResponse.json({ count: deleted.length });
  } catch (error: unknown) {
    return NextResponse.json({
      error:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
}
