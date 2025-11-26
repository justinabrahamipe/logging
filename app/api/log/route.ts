import { NextRequest, NextResponse } from "next/server";
import { db, logs, contacts, places } from "@/lib/db";
import { desc, eq, inArray } from "drizzle-orm";

export const maxDuration = 10;
export const dynamic = 'force-dynamic';

// Helper to parse contactIds string to array
function parseContactIds(contactIds: string | null): number[] {
  if (!contactIds) return [];
  return contactIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
}

// Helper to convert array to contactIds string
function stringifyContactIds(ids: number[]): string | null {
  if (!ids || ids.length === 0) return null;
  return ids.join(',');
}

// Helper to fetch contacts by IDs
async function fetchContacts(contactIds: number[]) {
  if (contactIds.length === 0) return [];
  const contactList = await db.select({
    id: contacts.id,
    name: contacts.name,
    photoUrl: contacts.photoUrl
  }).from(contacts).where(inArray(contacts.id, contactIds));
  return contactList;
}

// Helper to fetch place by ID
async function fetchPlace(placeId: number | null) {
  if (!placeId) return null;
  const [place] = await db.select({
    id: places.id,
    name: places.name,
    address: places.address
  }).from(places).where(eq(places.id, placeId));
  return place || null;
}

// Helper to enrich log with contacts and place
async function enrichLog(log: any) {
  const contactIds = parseContactIds(log.contactIds);
  const contactList = await fetchContacts(contactIds);
  const place = await fetchPlace(log.placeId);
  return {
    ...log,
    contacts: contactList,
    place
  };
}

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
        place: {
          columns: {
            id: true,
            name: true,
            address: true
          }
        }
      }
    });

    // Enrich with contacts
    const enrichedData = await Promise.all(data.map(async (log) => {
      const contactIds = parseContactIds(log.contactIds);
      const contactList = await fetchContacts(contactIds);
      return {
        ...log,
        contacts: contactList
      };
    }));

    return NextResponse.json({ data: enrichedData }, { status: 200 });
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

    // Handle placeId - take first one if array provided
    const placeId = Array.isArray(body.placeIds) && body.placeIds.length > 0
      ? body.placeIds[0]
      : (body.placeId || null);

    // Handle contactIds - convert array to comma-separated string
    const contactIds = Array.isArray(body.contactIds) && body.contactIds.length > 0
      ? stringifyContactIds(body.contactIds)
      : null;

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
      userId: body.userId || null,
      placeId: placeId ? parseInt(placeId) : null,
      contactIds
    }).returning();

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
        place: {
          columns: {
            id: true,
            name: true,
            address: true
          }
        }
      }
    });

    // Enrich with contacts
    const enrichedResponse = await enrichLog(response);

    console.log("Created log:", enrichedResponse);
    return NextResponse.json(enrichedResponse, { status: 201 });
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

    // Handle placeId - take first one if array provided
    if (body.placeIds !== undefined) {
      updateData.placeId = Array.isArray(body.placeIds) && body.placeIds.length > 0
        ? parseInt(body.placeIds[0])
        : null;
    } else if (body.placeId !== undefined) {
      updateData.placeId = body.placeId ? parseInt(body.placeId) : null;
    }

    // Handle contactIds - convert array to comma-separated string
    if (body.contactIds !== undefined) {
      updateData.contactIds = Array.isArray(body.contactIds) && body.contactIds.length > 0
        ? stringifyContactIds(body.contactIds)
        : null;
    }

    await db.update(logs)
      .set(updateData)
      .where(eq(logs.id, parseInt(id)));

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
        place: {
          columns: {
            id: true,
            name: true,
            address: true
          }
        }
      }
    });

    // Enrich with contacts
    const enrichedResponse = await enrichLog(response);

    console.log("Updated log:", enrichedResponse);
    return NextResponse.json(enrichedResponse, { status: 200 });
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
