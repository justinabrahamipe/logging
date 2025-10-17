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

    if (!account) {
      return NextResponse.json(
        { error: "Google account not connected" },
        { status: 400 }
      );
    }

    let accessToken = account.access_token;

    // Check if token is expired and refresh if needed
    if (account.expires_at && account.expires_at < Math.floor(Date.now() / 1000)) {
      console.log('[SYNC] Token expired, refreshing...');

      if (!account.refresh_token) {
        return NextResponse.json(
          { error: "Refresh token not available. Please sign out and sign in again." },
          { status: 401 }
        );
      }

      // Refresh the token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          grant_type: 'refresh_token',
          refresh_token: account.refresh_token,
        }),
      });

      if (!tokenResponse.ok) {
        console.error('[SYNC] Token refresh failed:', await tokenResponse.text());
        return NextResponse.json(
          { error: "Failed to refresh token. Please sign out and sign in again." },
          { status: 401 }
        );
      }

      const tokens = await tokenResponse.json();

      // Update the account with new tokens
      await prisma.account.update({
        where: { id: account.id },
        data: {
          access_token: tokens.access_token,
          expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
        },
      });

      accessToken = tokens.access_token;
      console.log('[SYNC] Token refreshed successfully');
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: "Access token not available" },
        { status: 400 }
      );
    }

    // Fetch ignored contacts
    const ignoredContacts = await prisma.ignoredContact.findMany({
      where: {
        userId: session.user.id
      },
      select: {
        googleId: true
      }
    });
    const ignoredGoogleIds = new Set(ignoredContacts.map(ic => ic.googleId));

    // Fetch ALL contacts from Google People API with pagination
    let allConnections: any[] = [];
    let pageToken: string | undefined;
    let pageCount = 0;
    const maxPages = 10; // Safety limit (10 pages * 1000 = 10,000 contacts max)

    do {
      const url = new URL('https://people.googleapis.com/v1/people/me/connections');
      url.searchParams.set('personFields', 'names,emailAddresses,phoneNumbers,photos,organizations,addresses,birthdays,events');
      url.searchParams.set('pageSize', '1000');
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

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
      allConnections = allConnections.concat(connections);

      pageToken = data.nextPageToken;
      pageCount++;

      console.log(`[SYNC] Fetched page ${pageCount}, got ${connections.length} contacts, total: ${allConnections.length}`);
    } while (pageToken && pageCount < maxPages);

    console.log(`[SYNC] Fetched total of ${allConnections.length} contacts from Google`);

    const connections = allConnections;

    // Process and save contacts
    const savedContacts = [];
    let skippedCount = 0;

    for (const person of connections) {
      const googleId = person.resourceName;

      // Skip if contact is in ignored list
      if (googleId && ignoredGoogleIds.has(googleId)) {
        skippedCount++;
        continue;
      }

      const name = person.names?.[0]?.displayName || "Unknown";
      const email = person.emailAddresses?.[0]?.value;
      const phoneNumber = person.phoneNumbers?.[0]?.value;
      const photoUrl = person.photos?.[0]?.url;
      const organization = person.organizations?.[0]?.name;
      const jobTitle = person.organizations?.[0]?.title;

      // Extract address
      const addressObj = person.addresses?.[0];
      const address = addressObj ?
        [
          addressObj.streetAddress,
          addressObj.city,
          addressObj.region,
          addressObj.postalCode,
          addressObj.country
        ].filter(Boolean).join(', ') :
        null;

      // Extract birthday
      let birthday = null;
      if (person.birthdays?.[0]?.date) {
        const bd = person.birthdays[0].date;
        // Google birthday might not have year
        const year = bd.year || 1900; // Use 1900 as placeholder if year not provided
        const month = bd.month || 1;
        const day = bd.day || 1;
        birthday = new Date(year, month - 1, day);
      }

      // Extract wedding anniversary
      let weddingAnniversary = null;
      const anniversaryEvent = person.events?.find(
        (event: { type: string }) => event.type === 'anniversary'
      );
      if (anniversaryEvent?.date) {
        const ad = anniversaryEvent.date;
        const year = ad.year || 1900;
        const month = ad.month || 1;
        const day = ad.day || 1;
        weddingAnniversary = new Date(year, month - 1, day);
      }

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
          address,
          birthday,
          weddingAnniversary,
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
          address,
          birthday,
          weddingAnniversary,
          lastSynced: new Date()
        }
      });

      savedContacts.push(contact);
    }

    console.log(`[SYNC] Processed ${savedContacts.length} contacts, skipped ${skippedCount} ignored contacts`);

    return NextResponse.json({
      success: true,
      count: savedContacts.length,
      skipped: skippedCount,
      total: connections.length,
      contacts: savedContacts
    }, { status: 200 });

  } catch (error) {
    console.error("POST /api/contacts/sync error:", error);
    // Return empty success response to prevent client-side crashes
    return NextResponse.json({
      success: false,
      count: 0,
      skipped: 0,
      total: 0,
      contacts: []
    }, { status: 200 });
  }
}
