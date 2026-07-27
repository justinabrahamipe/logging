import { db, pillars, cycles, locationLogs } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getTodayString } from "@/lib/format";
import { createAutoLog } from "@/lib/auto-log";
import { getOwnedPillar, getOwnedCycle } from "@/lib/db-utils";
import { mapPillarUpdateFields, mapCycleUpdateFields } from "@/lib/task-utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleCreatePillar(args: any, userId: string): Promise<string> {
  const pillarName = args.name;
  if (!pillarName) return "Error: name is required.";

  const [pillar] = await db.insert(pillars).values({
    userId,
    name: pillarName,
    emoji: args.emoji || '📌',
    color: args.color || '#3B82F6',
    defaultBasePoints: args.defaultBasePoints ?? 10,
    description: args.description || null,
  }).returning();

  await createAutoLog(userId, `📌 Pillar created: ${pillarName}`);
  return `Pillar "${pillarName}" created. Pillar ID: ${pillar.id}.`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleEditPillar(args: any, userId: string): Promise<string> {
  const pillarId = parseInt(args.pillarId, 10);
  if (!pillarId) return "Error: pillarId is required.";

  const existing = await getOwnedPillar(pillarId, userId);
  if (!existing) return "Error: Pillar not found.";

  const updateData = mapPillarUpdateFields(args);
  if (Object.keys(updateData).length === 0) return "Error: No fields to update.";

  await db.update(pillars).set(updateData).where(and(eq(pillars.id, pillarId), eq(pillars.userId, userId)));
  await createAutoLog(userId, `✏️ Pillar updated: ${args.name || existing.name}`);
  return `Pillar "${args.name || existing.name}" updated.`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleCreateCycle(args: any, userId: string): Promise<string> {
  const cycleName = args.name;
  if (!cycleName || !args.startDate || !args.endDate) return "Error: name, startDate, and endDate are required.";

  const [cycle] = await db.insert(cycles).values({
    userId,
    name: cycleName,
    startDate: args.startDate,
    endDate: args.endDate,
    vision: args.vision || null,
    theme: args.theme || null,
  }).returning();

  await createAutoLog(userId, `📅 Cycle created: ${cycleName}`);
  return `Cycle "${cycleName}" created (${args.startDate} to ${args.endDate}). Cycle ID: ${cycle.id}. Use this ID as periodId when creating goals.`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleEditCycle(args: any, userId: string): Promise<string> {
  const cycleId = parseInt(args.cycleId, 10);
  if (!cycleId) return "Error: cycleId is required.";

  const existing = await getOwnedCycle(cycleId, userId);
  if (!existing) return "Error: Cycle not found.";

  const updateData = mapCycleUpdateFields(args);
  if (Object.keys(updateData).length === 0) return "Error: No fields to update.";

  await db.update(cycles).set(updateData).where(and(eq(cycles.id, cycleId), eq(cycles.userId, userId)));
  await createAutoLog(userId, `✏️ Cycle updated: ${args.name || existing.name}`);
  return `Cycle "${args.name || existing.name}" updated.`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleAddLog(args: any, userId: string): Promise<string> {
  const notes = args.notes;
  if (!notes) return "Error: notes is required.";

  const date = args.date || getTodayString();
  const now = new Date();
  const time = args.time || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const latitude = args.latitude != null ? parseFloat(args.latitude) : 0;
  const longitude = args.longitude != null ? parseFloat(args.longitude) : 0;

  await db.insert(locationLogs).values({
    userId,
    latitude,
    longitude,
    date,
    time,
    notes,
  });

  const locStr = (latitude !== 0 || longitude !== 0) ? ` at ${latitude}, ${longitude}` : '';
  return `Log added for ${date} at ${time}${locStr}: "${notes}"`;
}
