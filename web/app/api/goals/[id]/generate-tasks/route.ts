import { NextResponse } from "next/server";
import { getAuthenticatedUserId, errorResponse, parseId } from "@/lib/api-utils";
import { generateGoalTasks } from "@/lib/ensure-upcoming-tasks";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();
    const { id } = await params;
    const goalId = parseId(id);

    await generateGoalTasks(userId, goalId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
