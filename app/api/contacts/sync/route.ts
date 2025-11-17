import { NextResponse } from "next/server";
import { db, accounts, ignoredContacts, contacts } from "@/lib/db";
import { auth } from "@/auth";
import { eq, and } from "drizzle-orm";

export const maxDuration = 60; // Increased to 60 seconds for large contact lists
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
    const account = await db.query.accounts.findFirst({
      where: and(
        eq(accounts.userId, session.user.id),
        eq(accounts.provider, "google")
      )
    });

    if (!account) {
      return NextResponse.json(
        { error: "Google account not connected" },
        { status: 400 }
      );
    }

    let accessToken = account.accessToken;

    // Check if token is expired and refresh if needed
    if (account.expiresAt && account.expiresAt < Math.floor(Date.now() / 1000)) {
      console.log('[SYNC] Token expired, refreshing...');

      if (!account.refreshToken) {
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
          refresh_token: account.refreshToken,
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
      await db.update(accounts)
        .set({
          accessToken: tokens.access_token,
          expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
        })
        .where(eq(accounts.id, account.id));

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
    const ignoredContactsList = await db.select({ googleId: ignoredContacts.googleId })
      .from(ignoredContacts)
      .where(eq(ignoredContacts.userId, session.user.id));
    const ignoredGoogleIds = new Set(ignoredContactsList.map(ic => ic.googleId));

    // Fetch all contacts from Google People API with pagination
    let allConnections: any[] = [];
    let pageToken: string | undefined;
    let pageCount = 0;
    const maxPages = 10; // Limit to 10 pages (10,000 contacts) to stay within timeout

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

      console.log(`[SYNC] Fetched page ${pageCount}: ${connections.length} contacts (total: ${allConnections.length})`);
    } while (pageToken && pageCount < maxPages);

    const connections = allConnections;
    console.log(`[SYNC] Total fetched ${connections.length} contacts from Google across ${pageCount} pages`);

    // Process contacts in parallel batches for better performance
    let skippedCount = 0;
    const contactsToSync = connections.filter((person: any) => {
      const googleId = person.resourceName;
      if (googleId && ignoredGoogleIds.has(googleId)) {
        skippedCount++;
        return false;
      }
      return true;
    });

    // Use Promise.all for parallel processing (limit to 50 at a time)
    const batchSize = 50;
    const savedContacts = [];

    for (let i = 0; i < contactsToSync.length; i += batchSize) {
      const batch = contactsToSync.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (person: any) => {
          const googleId = person.resourceName;
          const name = person.names?.[0]?.displayName || "Unknown";
          const email = person.emailAddresses?.[0]?.value;
          const phoneNumber = person.phoneNumbers?.[0]?.value;
          const photoUrl = person.photos?.[0]?.url;
          const organization = person.organizations?.[0]?.name;
          const jobTitle = person.organizations?.[0]?.title;

          const addressObj = person.addresses?.[0];
          const address = addressObj ?
            [addressObj.streetAddress, addressObj.city, addressObj.region, addressObj.postalCode, addressObj.country]
              .filter(Boolean).join(', ') : null;

          let birthday = null;
          if (person.birthdays?.[0]?.date) {
            const bd = person.birthdays[0].date;
            birthday = new Date(bd.year || 1900, (bd.month || 1) - 1, bd.day || 1);
          }

          let weddingAnniversary = null;
          const anniversaryEvent = person.events?.find((e: any) => e.type === 'anniversary');
          if (anniversaryEvent?.date) {
            const ad = anniversaryEvent.date;
            weddingAnniversary = new Date(ad.year || 1900, (ad.month || 1) - 1, ad.day || 1);
          }

          // Check if contact exists
          const existingContact = await db.query.contacts.findFirst({
            where: and(
              eq(contacts.userId, session.user!.id),
              eq(contacts.googleId, googleId || `temp-${Date.now()}-${Math.random()}`)
            )
          });

          if (existingContact) {
            // Update existing contact
            const [updated] = await db.update(contacts)
              .set({
                name, email, phoneNumber, photoUrl, organization, jobTitle, address, birthday, weddingAnniversary,
                lastSynced: new Date(), updatedAt: new Date()
              })
              .where(eq(contacts.id, existingContact.id))
              .returning();
            return updated;
          } else {
            // Create new contact
            const [created] = await db.insert(contacts)
              .values({
                userId: session.user!.id, googleId, name, email, phoneNumber, photoUrl, organization, jobTitle,
                address, birthday, weddingAnniversary, lastSynced: new Date()
              })
              .returning();
            return created;
          }
        })
      );
      savedContacts.push(...batchResults);
    }

    console.log(`[SYNC] Processed ${savedContacts.length} contacts, skipped ${skippedCount} ignored contacts`);

    return NextResponse.json({
      success: true,
      count: savedContacts.length,
      skipped: skippedCount,
      total: connections.length,
      hasMore: pageToken !== undefined,
      pagesFetched: pageCount,
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
