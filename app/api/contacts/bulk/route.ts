import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

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
    const contacts = await prisma.contact.findMany({
      where: {
        id: {
          in: body.ids
        },
        userId: session.user.id
      },
      select: {
        id: true,
        googleId: true,
        name: true
      }
    });

    // Add contacts with googleIds to ignored list
    const contactsToIgnore = contacts.filter(c => c.googleId);
    if (contactsToIgnore.length > 0) {
      await Promise.all(
        contactsToIgnore.map(contact =>
          prisma.ignoredContact.upsert({
            where: {
              userId_googleId: {
                userId: session.user.id,
                googleId: contact.googleId!
              }
            },
            update: {},
            create: {
              userId: session.user.id,
              googleId: contact.googleId!,
              name: contact.name
            }
          })
        )
      );
    }

    // Delete the contacts
    const response = await prisma.contact.deleteMany({
      where: {
        id: {
          in: body.ids
        },
        userId: session.user.id
      },
    });

    return NextResponse.json(
      {
        success: true,
        deleted: response.count
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/contacts/bulk error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      },
      { status: 500 }
    );
  }
}
