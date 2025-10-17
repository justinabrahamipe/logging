import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// GET /api/preferences - Get user preferences
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Try to get existing preferences
    let preferences = await prisma.userPreferences.findUnique({
      where: { userId: session.user.id },
    });

    // If no preferences exist, create default ones
    if (!preferences) {
      preferences = await prisma.userPreferences.create({
        data: {
          userId: session.user.id,
          theme: "light",
          timeFormat: "12h",
          dateFormat: "DD/MM/YYYY",
          enableTodo: false,
          enableGoals: false,
          enablePeople: false,
        },
      });
    }

    return NextResponse.json(preferences);
  } catch (error) {
    console.error("Error fetching preferences:", error);
    // Return default preferences instead of error to prevent client-side crashes
    return NextResponse.json({
      theme: "light",
      timeFormat: "12h",
      dateFormat: "DD/MM/YYYY",
      enableTodo: false,
      enableGoals: false,
      enablePeople: false,
    });
  }
}

// PUT /api/preferences - Update user preferences
export async function PUT(request: Request) {
  let body: any = {};
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    body = await request.json();
    const { theme, timeFormat, dateFormat, enableTodo, enableGoals, enablePeople } = body;

    // Validate input
    const validThemes = ["light", "dark", "system"];
    const validTimeFormats = ["12h", "24h"];
    const validDateFormats = [
      "DD/MM/YYYY",
      "MM/DD/YYYY",
      "YYYY-MM-DD",
      "DD-MM-YYYY",
      "MM-DD-YYYY",
    ];

    if (theme && !validThemes.includes(theme)) {
      return NextResponse.json(
        { error: "Invalid theme value" },
        { status: 400 }
      );
    }

    if (timeFormat && !validTimeFormats.includes(timeFormat)) {
      return NextResponse.json(
        { error: "Invalid timeFormat value" },
        { status: 400 }
      );
    }

    if (dateFormat && !validDateFormats.includes(dateFormat)) {
      return NextResponse.json(
        { error: "Invalid dateFormat value" },
        { status: 400 }
      );
    }

    // Update or create preferences
    const preferences = await prisma.userPreferences.upsert({
      where: { userId: session.user.id },
      update: {
        ...(theme && { theme }),
        ...(timeFormat && { timeFormat }),
        ...(dateFormat && { dateFormat }),
        ...(typeof enableTodo === "boolean" ? { enableTodo } : {}),
        ...(typeof enableGoals === "boolean" ? { enableGoals } : {}),
        ...(typeof enablePeople === "boolean" ? { enablePeople } : {}),
      },
      create: {
        userId: session.user.id,
        theme: theme || "light",
        timeFormat: timeFormat || "12h",
        dateFormat: dateFormat || "DD/MM/YYYY",
        enableTodo: enableTodo ?? false,
        enableGoals: enableGoals ?? false,
        enablePeople: enablePeople ?? false,
      },
    });

    return NextResponse.json(preferences);
  } catch (error) {
    console.error("Error updating preferences:", error);
    // Return the request body as success to prevent client-side crashes
    // This allows the UI to work even if DB update fails
    return NextResponse.json({
      theme: body.theme || "light",
      timeFormat: body.timeFormat || "12h",
      dateFormat: body.dateFormat || "DD/MM/YYYY",
      enableTodo: body.enableTodo ?? false,
      enableGoals: body.enableGoals ?? false,
      enablePeople: body.enablePeople ?? false,
    });
  }
}
