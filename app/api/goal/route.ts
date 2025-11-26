import { NextRequest, NextResponse } from "next/server";
import { db, goals, logs, contacts, places } from "@/lib/db";
import { desc, eq, and, gte, lte, inArray } from "drizzle-orm";

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

export async function GET() {
  try {
    const data = await db.query.goals.findMany({
      orderBy: [desc(goals.createdOn)],
      with: {
        place: {
          columns: {
            id: true,
            name: true,
            address: true
          }
        }
      }
    });

    // Calculate current progress for each goal and enrich with contacts
    const goalsWithProgress = await Promise.all(
      data.map(async (goal) => {
        let currentValue = 0;

        // Get all logs associated with this goal
        const startDate = new Date(goal.startDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(goal.endDate);
        endDate.setHours(23, 59, 59, 999);

        const goalLogs = await db.select().from(logs).where(
          and(
            eq(logs.goalId, goal.id),
            gte(logs.startTime, startDate),
            lte(logs.startTime, endDate)
          )
        );

        if (goal.metricType === 'time') {
          currentValue = goalLogs.reduce((sum, log) => {
            if (log.startTime && log.endTime) {
              const duration = new Date(log.endTime).getTime() - new Date(log.startTime).getTime();
              return sum + (duration / (1000 * 60 * 60));
            }
            return sum;
          }, 0);
        } else if (goal.metricType === 'count') {
          currentValue = goalLogs.reduce((sum, log) => sum + (log.goalCount || 0), 0);
        }

        const now = new Date();
        const totalDuration = goal.endDate.getTime() - goal.startDate.getTime();
        const elapsed = now.getTime() - goal.startDate.getTime();
        const remaining = goal.endDate.getTime() - now.getTime();
        const daysRemaining = Math.ceil(remaining / (1000 * 60 * 60 * 24));
        const percentElapsed = Math.min((elapsed / totalDuration) * 100, 100);
        const percentComplete = (currentValue / goal.targetValue) * 100;

        let dailyTarget = 0;
        if (daysRemaining > 0 && currentValue < goal.targetValue) {
          dailyTarget = (goal.targetValue - currentValue) / daysRemaining;
        }

        const isCompleted = goal.goalType === 'limiting'
          ? (now > goal.endDate && currentValue <= goal.targetValue)
          : currentValue >= goal.targetValue;

        const isOverdue = goal.goalType === 'limiting'
          ? currentValue > goal.targetValue
          : (now > goal.endDate && currentValue < goal.targetValue);

        // Fetch contacts
        const contactIdsList = parseContactIds(goal.contactIds);
        const contactList = await fetchContacts(contactIdsList);

        return {
          ...goal,
          currentValue,
          percentComplete,
          percentElapsed,
          daysRemaining: Math.max(0, daysRemaining),
          dailyTarget,
          isCompleted,
          isOverdue,
          contacts: contactList
        };
      })
    );

    return NextResponse.json({ data: goalsWithProgress }, { status: 200 });
  } catch (error) {
    console.error("GET /api/goal error:", error);
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

    if (!body.title || !body.goalType || !body.metricType || !body.targetValue || !body.startDate || !body.endDate) {
      return NextResponse.json(
        { error: "Missing required fields" },
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

    const [goal] = await db.insert(goals).values({
      title: body.title,
      description: body.description || null,
      goalType: body.goalType,
      metricType: body.metricType,
      targetValue: parseFloat(body.targetValue),
      currentValue: 0,
      periodType: body.periodType || 'custom',
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      activityTitle: body.activityTitle || null,
      activityCategory: body.activityCategory || null,
      color: body.color || null,
      icon: body.icon || null,
      isActive: body.isActive !== undefined ? body.isActive : true,
      isRecurring: body.isRecurring || false,
      recurrencePattern: body.recurrencePattern || null,
      recurrenceConfig: body.recurrenceConfig || null,
      parentGoalId: body.parentGoalId || null,
      placeId: placeId ? parseInt(placeId) : null,
      contactIds
    }).returning();

    // Fetch the complete goal with relationships
    const response = await db.query.goals.findFirst({
      where: eq(goals.id, goal.id),
      with: {
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
    const contactIdsList = parseContactIds(response?.contactIds || null);
    const contactList = await fetchContacts(contactIdsList);

    return NextResponse.json({ ...response, contacts: contactList }, { status: 201 });
  } catch (error) {
    console.error("POST /api/goal error:", error);
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
    const body = await request.json();
    console.log("PUT /api/goal - Received body:", JSON.stringify(body, null, 2));

    if (!body.id) {
      return NextResponse.json(
        { error: "id is required for updates" },
        { status: 400 }
      );
    }

    const { id, ...updateData } = body;

    const data: any = { ...updateData };

    if (updateData.targetValue !== undefined) {
      data.targetValue = parseFloat(updateData.targetValue);
    }
    if (updateData.currentValue !== undefined) {
      data.currentValue = parseFloat(updateData.currentValue);
    }
    if (updateData.startDate) {
      data.startDate = new Date(updateData.startDate);
    }
    if (updateData.endDate) {
      data.endDate = new Date(updateData.endDate);
    }

    // Handle placeId - take first one if array provided
    if (updateData.placeIds !== undefined) {
      data.placeId = Array.isArray(updateData.placeIds) && updateData.placeIds.length > 0
        ? parseInt(updateData.placeIds[0])
        : null;
      delete data.placeIds;
    } else if (updateData.placeId !== undefined) {
      data.placeId = updateData.placeId ? parseInt(updateData.placeId) : null;
    }

    // Handle contactIds - convert array to comma-separated string
    if (updateData.contactIds !== undefined) {
      data.contactIds = Array.isArray(updateData.contactIds) && updateData.contactIds.length > 0
        ? stringifyContactIds(updateData.contactIds)
        : null;
    }

    await db.update(goals)
      .set(data)
      .where(eq(goals.id, parseInt(id)));

    // Fetch the updated goal with relationships
    const response = await db.query.goals.findFirst({
      where: eq(goals.id, parseInt(id)),
      with: {
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
    const contactIdsList = parseContactIds(response?.contactIds || null);
    const contactList = await fetchContacts(contactIdsList);

    console.log("PUT /api/goal - Update successful");
    return NextResponse.json({ ...response, contacts: contactList }, { status: 200 });
  } catch (error) {
    console.error("PUT /api/goal error:", error);
    console.error("Error details:", error instanceof Error ? error.stack : error);
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

    if (!body.id) {
      return NextResponse.json(
        { error: "id is required for deletion" },
        { status: 400 }
      );
    }

    const response = await db.delete(goals)
      .where(eq(goals.id, parseInt(body.id)))
      .returning();

    return NextResponse.json(response[0], { status: 200 });
  } catch (error) {
    console.error("DELETE /api/goal error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      },
      { status: 500 }
    );
  }
}
