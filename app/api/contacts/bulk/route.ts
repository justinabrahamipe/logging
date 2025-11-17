import { NextRequest, NextResponse } from "next/server";
import { db, contacts, ignoredContacts } from "@/lib/db";
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

    // Find contacts to get their googleIds
    const foundContacts = await db.select({
      id: contacts.id,
      googleId: contacts.googleId,
      name: contacts.name
    })
    .from(contacts)
    .where(and(
      inArray(contacts.id, body.ids),
      eq(contacts.userId, session.user.id)
    ));

    // Add contacts with googleIds to ignored list
    const contactsToIgnore = foundContacts.filter(c => c.googleId);
    if (contactsToIgnore.length > 0) {
      for (const contact of contactsToIgnore) {
        // Check if ignored contact already exists
        const existingIgnored = await db.query.ignoredContacts.findFirst({
          where: and(
            eq(ignoredContacts.userId, session.user.id),
            eq(ignoredContacts.googleId, contact.googleId!)
          )
        });

        if (!existingIgnored) {
          // Create new ignored contact
          await db.insert(ignoredContacts).values({
            userId: session.user.id,
            googleId: contact.googleId!,
            name: contact.name
          });
        }
      }
    }

    // Delete the contacts
    const deleted = await db.delete(contacts)
      .where(and(
        inArray(contacts.id, body.ids),
        eq(contacts.userId, session.user.id)
      ))
      .returning();

    return NextResponse.json(
      {
        success: true,
        deleted: deleted.length
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
