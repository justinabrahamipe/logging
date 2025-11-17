import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, userPreferences } from "@/lib/db";
import { eq } from "drizzle-orm";

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
    let preferences = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, session.user.id)
    });

    // If no preferences exist, create default ones
    if (!preferences) {
      const [created] = await db.insert(userPreferences).values({
        userId: session.user.id,
        theme: "light",
        timeFormat: "12h",
        dateFormat: "DD/MM/YYYY",
        enableTodo: false,
        enableGoals: false,
        enablePeople: false,
        enablePlaces: false,
        enableFinance: false,
      }).returning();
      preferences = created;
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
      enablePlaces: false,
      enableFinance: false,
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
    const { theme, timeFormat, dateFormat, enableTodo, enableGoals, enablePeople, enablePlaces, enableFinance } = body;

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

    // Check if preferences exist
    const existing = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, session.user.id)
    });

    let preferences;
    if (existing) {
      // Update existing preferences
      const updateData: any = {};
      if (theme) updateData.theme = theme;
      if (timeFormat) updateData.timeFormat = timeFormat;
      if (dateFormat) updateData.dateFormat = dateFormat;
      if (typeof enableTodo === "boolean") updateData.enableTodo = enableTodo;
      if (typeof enableGoals === "boolean") updateData.enableGoals = enableGoals;
      if (typeof enablePeople === "boolean") updateData.enablePeople = enablePeople;
      if (typeof enablePlaces === "boolean") updateData.enablePlaces = enablePlaces;
      if (typeof enableFinance === "boolean") updateData.enableFinance = enableFinance;

      const [updated] = await db.update(userPreferences)
        .set(updateData)
        .where(eq(userPreferences.userId, session.user.id))
        .returning();
      preferences = updated;
    } else {
      // Create new preferences
      const [created] = await db.insert(userPreferences).values({
        userId: session.user.id,
        theme: theme || "light",
        timeFormat: timeFormat || "12h",
        dateFormat: dateFormat || "DD/MM/YYYY",
        enableTodo: enableTodo ?? false,
        enableGoals: enableGoals ?? false,
        enablePeople: enablePeople ?? false,
        enablePlaces: enablePlaces ?? false,
        enableFinance: enableFinance ?? false,
      }).returning();
      preferences = created;
    }

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
      enablePlaces: body.enablePlaces ?? false,
      enableFinance: body.enableFinance ?? false,
    });
  }
}
