import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const maxDuration = 10;
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get the user's access token from the Account table
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "google"
      }
    });

    if (!account?.access_token) {
      return NextResponse.json(
        { error: "Google account not connected or access token not available" },
        { status: 400 }
      );
    }

    // Fetch contacts from Google People API
    const response = await fetch(
      'https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,photos,organizations&pageSize=1000',
      {
        headers: {
          Authorization: `Bearer ${account.access_token}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google People API error:", response.status, errorText);
      return NextResponse.json(
        { error: "Failed to fetch contacts from Google" },
        { status: response.status }
      );
    }

    const data = await response.json();
    const connections = data.connections || [];

    // Process and save contacts
    const savedContacts = [];

    for (const person of connections) {
      const name = person.names?.[0]?.displayName || "Unknown";
      const email = person.emailAddresses?.[0]?.value;
      const phoneNumber = person.phoneNumbers?.[0]?.value;
      const photoUrl = person.photos?.[0]?.url;
      const organization = person.organizations?.[0]?.name;
      const jobTitle = person.organizations?.[0]?.title;
      const googleId = person.resourceName;

      // Upsert contact (update if exists, create if not)
      const contact = await prisma.contact.upsert({
        where: {
          userId_googleId: {
            userId: session.user.id,
            googleId: googleId || `temp-${Date.now()}-${Math.random()}`
          }
        },
        update: {
          name,
          email,
          phoneNumber,
          photoUrl,
          organization,
          jobTitle,
          lastSynced: new Date(),
          updatedAt: new Date()
        },
        create: {
          userId: session.user.id,
          googleId: googleId,
          name,
          email,
          phoneNumber,
          photoUrl,
          organization,
          jobTitle,
          lastSynced: new Date()
        }
      });

      savedContacts.push(contact);
    }

    return NextResponse.json({
      success: true,
      count: savedContacts.length,
      contacts: savedContacts
    }, { status: 200 });

  } catch (error) {
    console.error("POST /api/contacts/sync error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      },
      { status: 500 }
    );
  }
}
