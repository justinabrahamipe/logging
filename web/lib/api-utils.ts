import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { resolveUserIdFromApiKey } from "@/lib/api-key-auth";

export async function getAuthenticatedUserId(): Promise<string> {
  // Bearer API key (used by the mobile app and other API clients) takes priority over the web session.
  const authHeader = (await headers()).get("authorization");
  const bearerKey = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (bearerKey) {
    const userId = await resolveUserIdFromApiKey(bearerKey);
    if (userId) return userId;
  }

  const session = await auth();
  if (!session?.user?.id) {
    throw new ApiError("Unauthorized", 401);
  }
  return session.user.id;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/** Parse a string to a positive integer, throwing ApiError if invalid. */
export function parseId(value: string): number {
  const num = parseInt(value, 10);
  if (isNaN(num) || num <= 0) {
    throw new ApiError("Invalid ID", 400);
  }
  return num;
}

/** Escape a CSV field to prevent formula injection. */
export function escapeCSV(value: string | number | null | undefined): string {
  if (value == null) return '""';
  const str = String(value);
  const escaped = str.replace(/"/g, '""');
  if (/^[=+\-@\t\r]/.test(escaped)) return `"'${escaped}"`;
  return `"${escaped}"`;
}
