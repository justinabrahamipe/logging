import { NextRequest, NextResponse } from "next/server";
import { db, todos, logs, activities, contacts, places, goals } from "@/lib/db";
import { asc, desc, eq, inArray, type InferSelectModel } from "drizzle-orm";
import { generateRecurrenceDeadlines, calculateWorkDate, generateRecurrenceGroupId } from "@/lib/recurrence-utils";

type Todo = InferSelectModel<typeof todos>;

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

// Helper to enrich todo with contacts
async function enrichTodo(todo: any) {
  const contactIdsList = parseContactIds(todo.contactIds);
  const contactList = await fetchContacts(contactIdsList);
  return {
    ...todo,
    contacts: contactList
  };
}

export async function GET() {
  try {
    const data = await db.query.todos.findMany({
      orderBy: [asc(todos.done), desc(todos.createdOn)],
      with: {
        place: {
          columns: {
            id: true,
            name: true,
            address: true
          }
        },
        goal: {
          columns: {
            id: true,
            title: true,
            color: true,
            icon: true
          }
        }
      }
    });

    // Enrich with contacts
    const enrichedData = await Promise.all(data.map(enrichTodo));

    return NextResponse.json({ data: enrichedData }, { status: 200 });
  } catch (error: unknown) {
    console.error("GET /api/todo error:", error);
    return NextResponse.json({
      error:
        error instanceof Error ? error.message : "An unknown error occurred",
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const title = body.title?.trim() || "";
    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    // Check if this is a recurring task
    const isRecurring = Boolean(body.isRecurring);
    const recurrencePattern = body.recurrencePattern || null;
    const recurrenceInterval = body.recurrenceInterval ? Number(body.recurrenceInterval) : 1;
    const recurrenceEndDate = body.recurrenceEndDate || null;
    const recurrenceCount = body.recurrenceCount ? Number(body.recurrenceCount) : undefined;
    const workDateOffset = body.workDateOffset ? Number(body.workDateOffset) : 0;

    // Handle placeId - take first one if array provided
    const placeId = Array.isArray(body.placeIds) && body.placeIds.length > 0
      ? parseInt(body.placeIds[0])
      : (body.placeId ? parseInt(body.placeId) : null);

    // Handle contactIds - convert array to comma-separated string
    const contactIds = Array.isArray(body.contactIds) && body.contactIds.length > 0
      ? stringifyContactIds(body.contactIds)
      : null;

    // Handle goalId - take first one if array provided
    const goalId = Array.isArray(body.goalIds) && body.goalIds.length > 0
      ? parseInt(body.goalIds[0])
      : (body.goalId ? parseInt(body.goalId) : null);

    const createdTodos: Todo[] = [];

    if (isRecurring && body.deadline && recurrencePattern && (recurrenceEndDate || recurrenceCount)) {
      // Generate all recurring instances
      const deadlines = generateRecurrenceDeadlines({
        startDate: body.deadline,
        pattern: recurrencePattern,
        interval: recurrenceInterval,
        endDate: recurrenceEndDate,
        count: recurrenceCount,
      });

      const groupId = generateRecurrenceGroupId();

      for (const deadline of deadlines) {
        const workDate = workDateOffset > 0 ? calculateWorkDate(deadline, workDateOffset) : null;

        const todoData = {
          title,
          description: body.description?.trim() || null,
          activityTitle: body.activityTitle?.trim() || null,
          activityCategory: body.activityCategory?.trim() || null,
          deadline,
          workDate,
          importance: Number(body.importance) || 1,
          urgency: Number(body.urgency) || 1,
          done: false,
          isRecurring: true,
          recurrencePattern,
          recurrenceInterval,
          recurrenceEndDate,
          recurrenceCount,
          workDateOffset,
          recurrenceGroupId: groupId,
          placeId,
          contactIds,
          goalId,
        };

        const [todo] = await db.insert(todos).values(todoData).returning();
        createdTodos.push(todo);
      }
    } else {
      // Single todo creation
      const todoData = {
        title,
        description: body.description?.trim() || null,
        activityTitle: body.activityTitle?.trim() || null,
        activityCategory: body.activityCategory?.trim() || null,
        deadline: body.deadline || null,
        workDate: body.work_date || null,
        importance: Number(body.importance) || 1,
        urgency: Number(body.urgency) || 1,
        done: Boolean(body.done),
        placeId,
        contactIds,
        goalId,
      };

      const [todo] = await db.insert(todos).values(todoData).returning();
      createdTodos.push(todo);
    }

    // For recurring, return the first todo; for single, return that todo
    const primaryTodo = createdTodos[0];

    // Fetch the complete todo with relationships
    const response = await db.query.todos.findFirst({
      where: eq(todos.id, primaryTodo.id),
      with: {
        place: {
          columns: {
            id: true,
            name: true,
            address: true
          }
        },
        goal: {
          columns: {
            id: true,
            title: true,
            color: true,
            icon: true
          }
        }
      }
    });

    // Enrich with contacts
    const enrichedResponse = await enrichTodo(response);

    // Include count of created todos for recurring tasks
    const result = isRecurring
      ? { ...enrichedResponse, recurringCount: createdTodos.length }
      : enrichedResponse;

    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/todo error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "An unknown error occurred",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "ID is required for update" },
        { status: 400 }
      );
    }

    const { id, work_date, ...updateData } = body;

    // Convert work_date to workDate if present
    const drizzleUpdateData: Record<string, unknown> = { ...updateData };
    if (work_date !== undefined) {
      drizzleUpdateData.workDate = work_date;
    }

    // Handle placeId - take first one if array provided
    if (updateData.placeIds !== undefined) {
      drizzleUpdateData.placeId = Array.isArray(updateData.placeIds) && updateData.placeIds.length > 0
        ? parseInt(updateData.placeIds[0])
        : null;
      delete drizzleUpdateData.placeIds;
    } else if (updateData.placeId !== undefined) {
      drizzleUpdateData.placeId = updateData.placeId ? parseInt(updateData.placeId) : null;
    }

    // Handle contactIds - convert array to comma-separated string
    if (updateData.contactIds !== undefined) {
      drizzleUpdateData.contactIds = Array.isArray(updateData.contactIds) && updateData.contactIds.length > 0
        ? stringifyContactIds(updateData.contactIds)
        : null;
    }

    // Handle goalId - take first one if array provided
    if (updateData.goalIds !== undefined) {
      drizzleUpdateData.goalId = Array.isArray(updateData.goalIds) && updateData.goalIds.length > 0
        ? parseInt(updateData.goalIds[0])
        : null;
      delete drizzleUpdateData.goalIds;
    } else if (updateData.goalId !== undefined) {
      drizzleUpdateData.goalId = updateData.goalId ? parseInt(updateData.goalId) : null;
    }

    await db.update(todos)
      .set(drizzleUpdateData)
      .where(eq(todos.id, Number(id)));

    // Create log entry when completing a todo with an activity
    if (body.done === true && body.activityTitle) {
      try {
        // Fetch the activity to get icon and color
        const activity = await db.query.activities.findFirst({
          where: eq(activities.title, body.activityTitle)
        });

        if (activity) {
          const now = new Date();
          await db.insert(logs).values({
            activityTitle: activity.title,
            activityCategory: activity.category,
            activityIcon: activity.icon,
            activityColor: activity.color,
            comment: `Completed: ${body.title}`,
            startTime: now,
            endTime: now,
            timeSpent: 0,
            todoId: Number(id),
          });
        }
      } catch (logError) {
        console.error("Error creating log for completed todo:", logError);
      }
    }

    // Fetch the updated todo with relationships
    const response = await db.query.todos.findFirst({
      where: eq(todos.id, Number(id)),
      with: {
        place: {
          columns: {
            id: true,
            name: true,
            address: true
          }
        },
        goal: {
          columns: {
            id: true,
            title: true,
            color: true,
            icon: true
          }
        }
      }
    });

    // Enrich with contacts
    const enrichedResponse = await enrichTodo(response);

    return NextResponse.json(enrichedResponse);
  } catch (error: unknown) {
    console.error("PUT /api/todo error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "An unknown error occurred",
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
        { error: "ID is required for delete" },
        { status: 400 }
      );
    }

    const response = await db.delete(todos)
      .where(eq(todos.id, Number(body.id)))
      .returning();
    return NextResponse.json({ count: response.length });
  } catch (error: unknown) {
    console.error("DELETE /api/todo error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "An unknown error occurred",
      },
      { status: 500 }
    );
  }
}
