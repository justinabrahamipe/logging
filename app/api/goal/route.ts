import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 10;
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await prisma.goal.findMany({
      include: {
        goalContacts: {
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
        goalPlaces: {
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
      orderBy: {
        created_on: 'desc'
      }
    });

    // Calculate current progress for each goal
    const goalsWithProgress = await Promise.all(
      data.map(async (goal) => {
        let currentValue = 0;

        // Get all logs associated with this goal
        // Use a broader date range to account for timezone differences
        const startDate = new Date(goal.startDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(goal.endDate);
        endDate.setHours(23, 59, 59, 999);

        const logs = await prisma.log.findMany({
          where: {
            goalId: goal.id,
            start_time: {
              gte: startDate,
              lte: endDate
            }
          }
        });

        if (goal.metricType === 'time') {
          // Sum up time spent (in minutes, convert to hours)
          currentValue = logs.reduce((sum, log) => {
            if (log.start_time && log.end_time) {
              const duration = new Date(log.end_time).getTime() - new Date(log.start_time).getTime();
              return sum + (duration / (1000 * 60 * 60)); // Convert to hours
            }
            return sum;
          }, 0);
        } else if (goal.metricType === 'count') {
          // Sum up goalCount values
          currentValue = logs.reduce((sum, log) => sum + (log.goalCount || 0), 0);
        }

        // Calculate statistics
        const now = new Date();
        const totalDuration = goal.endDate.getTime() - goal.startDate.getTime();
        const elapsed = now.getTime() - goal.startDate.getTime();
        const remaining = goal.endDate.getTime() - now.getTime();
        const daysRemaining = Math.ceil(remaining / (1000 * 60 * 60 * 24));
        const percentElapsed = Math.min((elapsed / totalDuration) * 100, 100);
        const percentComplete = (currentValue / goal.targetValue) * 100;

        // Calculate daily target to achieve goal
        let dailyTarget = 0;
        if (daysRemaining > 0 && currentValue < goal.targetValue) {
          dailyTarget = (goal.targetValue - currentValue) / daysRemaining;
        }

        // For limiting goals: completed only if period ended AND stayed under limit
        // For achievement goals: completed if target reached
        const isCompleted = goal.goalType === 'limiting'
          ? (now > goal.endDate && currentValue <= goal.targetValue)
          : currentValue >= goal.targetValue;

        // For limiting goals: overdue if exceeded limit OR period ended with value over limit
        // For achievement goals: overdue if period ended without reaching target
        const isOverdue = goal.goalType === 'limiting'
          ? currentValue > goal.targetValue
          : (now > goal.endDate && currentValue < goal.targetValue);

        return {
          ...goal,
          currentValue,
          percentComplete,
          percentElapsed,
          daysRemaining: Math.max(0, daysRemaining),
          dailyTarget,
          isCompleted,
          isOverdue
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

    // Validate required fields
    if (!body.title || !body.goalType || !body.metricType || !body.targetValue || !body.startDate || !body.endDate) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const goal = await prisma.goal.create({
      data: {
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
        parentGoalId: body.parentGoalId || null
      } as any
    });

    // Link contacts if provided
    if (body.contactIds && Array.isArray(body.contactIds) && body.contactIds.length > 0) {
      await prisma.goalContact.createMany({
        data: body.contactIds.map((contactId: number) => ({
          goalId: goal.id,
          contactId
        })),
        skipDuplicates: true
      });
    }

    // Link places if provided
    if (body.placeIds && Array.isArray(body.placeIds) && body.placeIds.length > 0) {
      await prisma.goalPlace.createMany({
        data: body.placeIds.map((placeId: number) => ({
          goalId: goal.id,
          placeId
        })),
        skipDuplicates: true
      });
    }

    // Fetch the complete goal with relationships
    const response = await prisma.goal.findUnique({
      where: { id: goal.id },
      include: {
        goalContacts: {
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
        goalPlaces: {
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

    const { id, contactIds, placeIds, ...updateData } = body;

    const data: any = { ...updateData };
    // Remove contactIds and placeIds from updateData if they exist
    delete data.contactIds;
    delete data.placeIds;

    if (updateData.targetValue !== undefined) {
      data.targetValue = parseFloat(updateData.targetValue);
    }
    if (updateData.currentValue !== undefined) {
      data.currentValue = parseFloat(updateData.currentValue);
    }
    if (updateData.startDate) {
      data.startDate = new Date(updateData.startDate);
      console.log("Converted startDate:", data.startDate);
    }
    if (updateData.endDate) {
      data.endDate = new Date(updateData.endDate);
      console.log("Converted endDate:", data.endDate);
    }

    console.log("PUT /api/goal - Data to update:", JSON.stringify(data, null, 2));

    await prisma.goal.update({
      where: { id: parseInt(id) },
      data: data as any
    });

    // Update contacts if provided
    if (contactIds !== undefined && Array.isArray(contactIds)) {
      // Remove all existing contacts
      await prisma.goalContact.deleteMany({
        where: { goalId: parseInt(id) }
      });

      // Add new contacts
      if (contactIds.length > 0) {
        await prisma.goalContact.createMany({
          data: contactIds.map((contactId: number) => ({
            goalId: parseInt(id),
            contactId
          })),
          skipDuplicates: true
        });
      }
    }

    // Update places if provided
    if (placeIds !== undefined && Array.isArray(placeIds)) {
      // Remove all existing places
      await prisma.goalPlace.deleteMany({
        where: { goalId: parseInt(id) }
      });

      // Add new places
      if (placeIds.length > 0) {
        await prisma.goalPlace.createMany({
          data: placeIds.map((placeId: number) => ({
            goalId: parseInt(id),
            placeId
          })),
          skipDuplicates: true
        });
      }
    }

    // Fetch the updated goal with relationships
    const response = await prisma.goal.findUnique({
      where: { id: parseInt(id) },
      include: {
        goalContacts: {
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
        goalPlaces: {
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

    console.log("PUT /api/goal - Update successful");
    return NextResponse.json(response, { status: 200 });
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

    const response = await prisma.goal.delete({
      where: { id: parseInt(body.id) }
    });

    return NextResponse.json(response, { status: 200 });
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
