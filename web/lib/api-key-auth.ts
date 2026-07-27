import { db, userPreferences } from "@/lib/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/** Resolves a `gc_...` API key to its owning user ID, migrating legacy plaintext keys to hashed storage. */
export async function resolveUserIdFromApiKey(key: string): Promise<string | null> {
  const hashed = hashKey(key);
  const [byHash] = await db
    .select({ userId: userPreferences.userId })
    .from(userPreferences)
    .where(eq(userPreferences.apiKeyHash, hashed));
  if (byHash?.userId) return byHash.userId;

  const [byPlain] = await db
    .select({ userId: userPreferences.userId })
    .from(userPreferences)
    .where(eq(userPreferences.apiKey, key));
  if (byPlain?.userId) {
    await db.update(userPreferences)
      .set({ apiKeyHash: hashed, apiKey: null })
      .where(eq(userPreferences.userId, byPlain.userId));
    return byPlain.userId;
  }

  return null;
}
