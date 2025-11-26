import { NextRequest, NextResponse } from "next/server";
import { db, contacts } from "@/lib/db";
import { auth } from "@/auth";
import { eq, and, inArray } from "drizzle-orm";

export const maxDuration = 10;
export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json(
        { error: "Contact IDs array is required" },
        { status: 400 }
      );
    }

    // Find contacts to check which have googleIds
    const foundContacts = await db.select({
      id: contacts.id,
      googleId: contacts.googleId,
    })
    .from(contacts)
    .where(and(
      inArray(contacts.id, body.ids),
      eq(contacts.userId, session.user.id)
    ));

    // Separate contacts with googleIds (mark as ignored) from manual ones (delete)
    const googleContactIds = foundContacts.filter(c => c.googleId).map(c => c.id);
    const manualContactIds = foundContacts.filter(c => !c.googleId).map(c => c.id);

    let ignoredCount = 0;
    let deletedCount = 0;

    // Mark Google contacts as ignored (so they won't reappear on sync)
    if (googleContactIds.length > 0) {
      await db.update(contacts)
        .set({ isIgnored: true, updatedAt: new Date() })
        .where(and(
          inArray(contacts.id, googleContactIds),
          eq(contacts.userId, session.user.id)
        ));
      ignoredCount = googleContactIds.length;
    }

    // Actually delete manual contacts
    if (manualContactIds.length > 0) {
      const deleted = await db.delete(contacts)
        .where(and(
          inArray(contacts.id, manualContactIds),
          eq(contacts.userId, session.user.id)
        ))
        .returning();
      deletedCount = deleted.length;
    }

    return NextResponse.json(
      {
        success: true,
        deleted: deletedCount,
        ignored: ignoredCount,
        total: ignoredCount + deletedCount
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/contacts/bulk error:", error);
    return NextResponse.json(
      {
        success: false,
        deleted: 0
      },
      { status: 200 }
    );
  }
}
