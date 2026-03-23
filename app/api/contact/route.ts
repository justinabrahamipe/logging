import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse } from "@/lib/api-utils";
import { db, contactMessages } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    const { topic, message } = await request.json();

    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    await db.insert(contactMessages).values({
      userId,
      topic: topic || "General Feedback",
      message: message.trim(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
