import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Helper function to normalize addresses for comparison
function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Helper function to check if address is valid (not just a country/city name)
function isValidAddress(address: string): boolean {
  const trimmed = address.trim();

  // Must have at least 10 characters
  if (trimmed.length < 10) {
    return false;
  }

  const normalized = trimmed.toLowerCase();

  // FIRST: Check if it's just "City, Country" or "State, Country" format
  // This is the most aggressive check - if there's only ONE comma and it's followed by a country name, reject it
  const singleCommaPattern = /^[^,]+,\s*(uk|usa|india|canada|australia|united kingdom|united states|england|scotland|wales)$/i;
  if (singleCommaPattern.test(normalized)) {
    // This catches "Mumbai, India", "Kerala, India", "London, UK", etc.
    return false;
  }

  // Check for "City Country" without comma (e.g., "London UK", "Mumbai India")
  const cityCountryPattern = /^[a-z\s]+\s+(uk|usa|india|canada|australia)$/i;
  if (cityCountryPattern.test(normalized)) {
    return false;
  }

  // Check for common invalid patterns (just country/city/state names)
  const invalidPatterns = [
    // Countries
    /^uk$/i,
    /^united kingdom$/i,
    /^england$/i,
    /^scotland$/i,
    /^wales$/i,
    /^northern ireland$/i,
    /^usa$/i,
    /^united states$/i,
    /^india$/i,
    /^canada$/i,
    /^australia$/i,

    // UK Cities
    /^london$/i,
    /^manchester$/i,
    /^birmingham$/i,
    /^liverpool$/i,
    /^leeds$/i,
    /^glasgow$/i,
    /^edinburgh$/i,
    /^cardiff$/i,
    /^belfast$/i,

    // US States and Cities
    /^new york$/i,
    /^california$/i,
    /^texas$/i,
    /^florida$/i,
    /^illinois$/i,
    /^pennsylvania$/i,
    /^ohio$/i,

    // Indian States and Cities
    /^kerala$/i,
    /^mumbai$/i,
    /^delhi$/i,
    /^bangalore$/i,
    /^chennai$/i,
    /^kolkata$/i,
    /^hyderabad$/i,
    /^pune$/i,
    /^karnataka$/i,
    /^maharashtra$/i,
    /^tamil nadu$/i,
    /^west bengal$/i,
    /^gujarat$/i,
    /^rajasthan$/i,
    /^uttar pradesh$/i,
    /^andhra pradesh$/i,
    /^telangana$/i,
  ];

  for (const pattern of invalidPatterns) {
    if (pattern.test(normalized)) {
      return false;
    }
  }

  // Address should contain at least a number (indicating street address)
  // OR have multiple commas (indicating proper address structure like "Street, City, State, Country")
  const hasNumber = /\d/.test(trimmed);
  const commaCount = (trimmed.match(/,/g) || []).length;

  // Valid addresses either:
  // 1. Have a number (street number/postal code)
  // 2. Have 2+ commas (proper address structure)
  if (hasNumber || commaCount >= 2) {
    return true;
  }

  return false;
}

// Helper function to extract first name, skipping salutations
function getFirstName(fullName: string): string {
  const salutations = ['mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'professor', 'sir', 'dame', 'lord', 'lady', 'rev', 'reverend', 'fr', 'father', 'sr', 'br', 'brother', 'sister'];
  const parts = fullName.trim().split(/\s+/);

  if (parts.length === 0) return '';

  // Check if first part is a salutation (with or without period)
  const firstPart = parts[0].toLowerCase().replace(/\./g, '');
  if (salutations.includes(firstPart) && parts.length > 1) {
    return parts[1];
  }

  return parts[0];
}

// Helper function to generate smart place names using first names
function generatePlaceName(contacts: Array<{ name: string }>): string {
  if (contacts.length === 0) return '';
  if (contacts.length === 1) {
    const firstName = getFirstName(contacts[0].name);
    return `${firstName}'s house`;
  }
  if (contacts.length === 2) {
    const firstName1 = getFirstName(contacts[0].name);
    const firstName2 = getFirstName(contacts[1].name);
    return `${firstName1} and ${firstName2}'s house`;
  }
  // For 3+ people, use first two names + "and X others"
  const firstName1 = getFirstName(contacts[0].name);
  const firstName2 = getFirstName(contacts[1].name);
  return `${firstName1}, ${firstName2}, and ${contacts.length - 2} others' house`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get all contacts with addresses
    const contacts = await prisma.contact.findMany({
      where: {
        userId: session.user.id,
        address: {
          not: null,
          not: ''
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    if (contacts.length === 0) {
      return NextResponse.json({
        message: "No contacts with addresses found",
        created: 0,
        skipped: 0
      }, { status: 200 });
    }

    // Group contacts by normalized address
    const addressGroups = new Map<string, typeof contacts>();

    for (const contact of contacts) {
      if (!contact.address) continue;

      // Skip invalid addresses
      if (!isValidAddress(contact.address)) {
        continue;
      }

      const normalized = normalizeAddress(contact.address);
      if (!addressGroups.has(normalized)) {
        addressGroups.set(normalized, []);
      }
      addressGroups.get(normalized)!.push(contact);
    }

    // Create places from address groups
    let created = 0;
    let skipped = 0;
    let skippedTooMany = 0;

    for (const [normalizedAddress, groupContacts] of addressGroups.entries()) {
      // Skip if more than 5 people at this address (likely not a home)
      if (groupContacts.length > 5) {
        skipped++;
        skippedTooMany++;
        continue;
      }

      // Use the first contact's address as the canonical address
      const address = groupContacts[0].address!;

      // Generate smart name
      const placeName = generatePlaceName(groupContacts);

      // Check if place already exists with this address
      const existingPlace = await prisma.place.findFirst({
        where: {
          userId: session.user.id,
          address: address
        }
      });

      if (existingPlace) {
        skipped++;
        continue;
      }

      // Create the place
      const place = await prisma.place.create({
        data: {
          userId: session.user.id,
          name: placeName,
          address: address,
          category: 'home', // Default to home
        }
      });

      // Link all contacts to this place
      // Note: SQLite doesn't support skipDuplicates in createMany, so we use individual creates
      for (const contact of groupContacts) {
        try {
          await prisma.placeContact.create({
            data: {
              placeId: place.id,
              contactId: contact.id
            }
          });
        } catch (error: any) {
          // Ignore duplicate errors (unique constraint violations)
          if (!error.code || error.code !== 'P2002') {
            throw error; // Re-throw if it's not a duplicate error
          }
        }
      }

      created++;
    }

    let message = `Successfully created ${created} places from contacts`;
    if (skippedTooMany > 0) {
      message += `. Skipped ${skippedTooMany} addresses with 6+ people`;
    }

    return NextResponse.json({
      message,
      created,
      skipped,
      totalContacts: contacts.length
    }, { status: 200 });
  } catch (error) {
    console.error("POST /api/places/import-from-contacts error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      },
      { status: 500 }
    );
  }
}
