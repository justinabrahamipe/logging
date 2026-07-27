import { db } from './db';
import { SQLiteTableWithColumns, TableConfig } from 'drizzle-orm/sqlite-core';

/**
 * SQLite-compatible bulk insert with duplicate handling
 *
 * Inserts multiple records and ignores unique constraint violations.
 */
export async function insertManyIgnoreDuplicates<T extends SQLiteTableWithColumns<TableConfig>>(
  table: T,
  data: T['$inferInsert'][]
): Promise<void> {
  if (data.length === 0) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.insert(table).values(data as any).onConflictDoNothing();
  } catch {
    // Fallback: insert one by one if batch insert fails
    for (const item of data) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await db.insert(table).values(item as any).onConflictDoNothing();
      } catch (err) {
        console.warn('Insert failed for item:', item, err);
      }
    }
  }
}
