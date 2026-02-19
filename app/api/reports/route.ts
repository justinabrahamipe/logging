import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { computeReport } from "@/lib/reports";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = request.nextUrl.searchParams.get("type") || "weekly";
  const dateParam = request.nextUrl.searchParams.get("date") || new Date().toISOString().split("T")[0];

  const report = await computeReport(session.user.id, type, dateParam);
  return NextResponse.json(report);
}
