import { db, tasks, goals, pillars, cycles, taskSchedules } from "@/lib/db";
import { inArray, eq, and } from "drizzle-orm";

export async function deleteTasksByIds(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await db.delete(tasks).where(inArray(tasks.id, ids));
}

// Ownership-checked single-row fetch helpers. Each returns the row or undefined.
export async function getOwnedGoal(id: number, userId: string) {
  const [row] = await db.select().from(goals).where(and(eq(goals.id, id), eq(goals.userId, userId)));
  return row;
}
export async function getOwnedTask(id: number, userId: string) {
  const [row] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
  return row;
}
export async function getOwnedPillar(id: number, userId: string) {
  const [row] = await db.select().from(pillars).where(and(eq(pillars.id, id), eq(pillars.userId, userId)));
  return row;
}
export async function getOwnedCycle(id: number, userId: string) {
  const [row] = await db.select().from(cycles).where(and(eq(cycles.id, id), eq(cycles.userId, userId)));
  return row;
}
export async function getOwnedSchedule(id: number, userId: string) {
  const [row] = await db.select().from(taskSchedules).where(and(eq(taskSchedules.id, id), eq(taskSchedules.userId, userId)));
  return row;
}
