import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, cycles, weeklyReviews } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const periodId = parseInt(id);

  const reviews = await db
    .select()
    .from(weeklyReviews)
    .where(and(eq(weeklyReviews.periodId, periodId), eq(weeklyReviews.userId, session.user.id)));

  return NextResponse.json(reviews);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const periodId = parseInt(id);
  const body = await request.json();
  const { review } = body as {
    review?: { weekNumber: number; notes?: string; wins?: string; blockers?: string };
  };

  // Get cycle to verify ownership
  const [cycle] = await db
    .select()
    .from(cycles)
    .where(and(eq(cycles.id, periodId), eq(cycles.userId, session.user.id)));

  if (!cycle) {
    return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
  }

  // Upsert weekly review if provided
  if (review?.weekNumber) {
    const [existing] = await db
      .select()
      .from(weeklyReviews)
      .where(
        and(
          eq(weeklyReviews.periodId, periodId),
          eq(weeklyReviews.weekNumber, review.weekNumber)
        )
      );

    if (existing) {
      await db
        .update(weeklyReviews)
        .set({
          notes: review.notes ?? existing.notes,
          wins: review.wins ?? existing.wins,
          blockers: review.blockers ?? existing.blockers,
          updatedAt: new Date(),
        })
        .where(eq(weeklyReviews.id, existing.id));
    } else {
      await db.insert(weeklyReviews).values({
        periodId,
        userId: session.user.id,
        weekNumber: review.weekNumber,
        notes: review.notes || null,
        wins: review.wins || null,
        blockers: review.blockers || null,
      });
    }
  }

  // Return updated reviews
  const result = await db
    .select()
    .from(weeklyReviews)
    .where(and(eq(weeklyReviews.periodId, periodId), eq(weeklyReviews.userId, session.user.id)));

  return NextResponse.json(result);
}
