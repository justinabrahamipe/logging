import { db, tasks } from "@/lib/db";
import { inArray } from "drizzle-orm";

export async function deleteTasksByIds(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await db.delete(tasks).where(inArray(tasks.id, ids));
}
