import { NextRequest, NextResponse } from "next/server";
import { insertManyIgnoreDuplicates } from "@/lib/drizzle-utils";
import { db, todos, todoContacts, todoPlaces, todoGoals, logs, activities } from "@/lib/db";
import { asc, desc, eq, type InferSelectModel } from "drizzle-orm";
import { generateRecurrenceDeadlines, calculateWorkDate, generateRecurrenceGroupId } from "@/lib/recurrence-utils";

type Todo = InferSelectModel<typeof todos>;

export const maxDuration = 10;
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await db.query.todos.findMany({
      orderBy: [asc(todos.done), desc(todos.createdOn)],
      with: {
        todoContacts: {
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
        todoPlaces: {
          with: {
            place: {
              columns: {
                id: true,
                name: true,
                address: true
              }
            }
          }
        },
        todoGoals: {
          with: {
            goal: {
              columns: {
                id: true,
                title: true,
                color: true,
                icon: true
              }
            }
          }
        }
      }
    });
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
        };

        const [todo] = await db.insert(todos).values(todoData).returning();

        // Link contacts, places, goals to each instance
        if (body.contactIds?.length > 0) {
          await insertManyIgnoreDuplicates(
            todoContacts,
            body.contactIds.map((contactId: number) => ({ todoId: todo.id, contactId }))
          );
        }
        if (body.placeIds?.length > 0) {
          await insertManyIgnoreDuplicates(
            todoPlaces,
            body.placeIds.map((placeId: number) => ({ todoId: todo.id, placeId }))
          );
        }
        if (body.goalIds?.length > 0) {
          await insertManyIgnoreDuplicates(
            todoGoals,
            body.goalIds.map((goalId: number) => ({ todoId: todo.id, goalId }))
          );
        }

        createdTodos.push(todo);
      }
    } else {
      // Single todo creation (existing logic)
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
      };

      const [todo] = await db.insert(todos).values(todoData).returning();

      // Link contacts if provided
      if (body.contactIds && Array.isArray(body.contactIds) && body.contactIds.length > 0) {
        await insertManyIgnoreDuplicates(
          todoContacts,
          body.contactIds.map((contactId: number) => ({
            todoId: todo.id,
            contactId
          }))
        );
      }

      // Link places if provided
      if (body.placeIds && Array.isArray(body.placeIds) && body.placeIds.length > 0) {
        await insertManyIgnoreDuplicates(
          todoPlaces,
          body.placeIds.map((placeId: number) => ({
            todoId: todo.id,
            placeId
          }))
        );
      }

      // Link goals if provided
      if (body.goalIds && Array.isArray(body.goalIds) && body.goalIds.length > 0) {
        await insertManyIgnoreDuplicates(
          todoGoals,
          body.goalIds.map((goalId: number) => ({
            todoId: todo.id,
            goalId
          }))
        );
      }

      createdTodos.push(todo);
    }

    // For recurring, return the first todo; for single, return that todo
    const primaryTodo = createdTodos[0];

    // Fetch the complete todo with relationships
    const response = await db.query.todos.findFirst({
      where: eq(todos.id, primaryTodo.id),
      with: {
        todoContacts: {
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
        todoPlaces: {
          with: {
            place: {
              columns: {
                id: true,
                name: true,
                address: true
              }
            }
          }
        },
        todoGoals: {
          with: {
            goal: {
              columns: {
                id: true,
                title: true,
                color: true,
                icon: true
              }
            }
          }
        }
      }
    });

    // Include count of created todos for recurring tasks
    const result = isRecurring
      ? { ...response, recurringCount: createdTodos.length }
      : response;

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

    const { id, contactIds, placeIds, goalIds, work_date, ...updateData } = body;

    // Convert work_date to workDate if present
    const drizzleUpdateData: Record<string, unknown> = { ...updateData };
    if (work_date !== undefined) {
      drizzleUpdateData.workDate = work_date;
    }

    await db.update(todos)
      .set(drizzleUpdateData)
      .where(eq(todos.id, Number(id)));

    // Update contacts if provided
    if (contactIds !== undefined && Array.isArray(contactIds)) {
      // Remove all existing contacts
      await db.delete(todoContacts).where(eq(todoContacts.todoId, Number(id)));

      // Add new contacts
      if (contactIds.length > 0) {
        await insertManyIgnoreDuplicates(
          todoContacts,
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
      await db.delete(todoPlaces).where(eq(todoPlaces.todoId, Number(id)));

      // Add new places
      if (placeIds.length > 0) {
        await insertManyIgnoreDuplicates(
          todoPlaces,
          placeIds.map((placeId: number) => ({
            todoId: Number(id),
            placeId
          }))
        );
      }
    }

    // Update goals if provided
    if (goalIds !== undefined && Array.isArray(goalIds)) {
      // Remove all existing goals
      await db.delete(todoGoals).where(eq(todoGoals.todoId, Number(id)));

      // Add new goals
      if (goalIds.length > 0) {
        await insertManyIgnoreDuplicates(
          todoGoals,
          goalIds.map((goalId: number) => ({
            todoId: Number(id),
            goalId
          }))
        );
      }
    }

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
        // Don't fail the todo update if log creation fails
      }
    }

    // Fetch the updated todo with relationships
    const response = await db.query.todos.findFirst({
      where: eq(todos.id, Number(id)),
      with: {
        todoContacts: {
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
        todoPlaces: {
          with: {
            place: {
              columns: {
                id: true,
                name: true,
                address: true
              }
            }
          }
        },
        todoGoals: {
          with: {
            goal: {
              columns: {
                id: true,
                title: true,
                color: true,
                icon: true
              }
            }
          }
        }
      }
    });

    return NextResponse.json(response);
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
