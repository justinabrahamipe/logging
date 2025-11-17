import { db } from './db';
import { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';

/**
 * SQLite-compatible bulk insert with duplicate handling
 *
 * Inserts multiple records and ignores unique constraint violations.
 */
export async function insertManyIgnoreDuplicates<T extends SQLiteTableWithColumns<any>>(
  table: T,
  data: any[]
): Promise<void> {
  if (data.length === 0) return;

  try {
    await db.insert(table).values(data).onConflictDoNothing();
  } catch (error) {
    // Fallback: insert one by one if batch insert fails
    for (const item of data) {
      try {
        await db.insert(table).values(item).onConflictDoNothing();
      } catch (err) {
        // Ignore errors
        console.warn('Insert failed for item:', item, err);
      }
    }
  }
}
