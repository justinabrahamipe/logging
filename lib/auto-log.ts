import { db, locationLogs } from "@/lib/db";

export async function createAutoLog(userId: string, message: string, date?: string) {
  try {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    await db.insert(locationLogs).values({
      userId,
      latitude: 0,
      longitude: 0,
      date: date || now.toISOString().split('T')[0],
      time: timeStr,
      notes: message,
    });
  } catch (err) {
    console.error("Failed to create auto-log:", err);
  }
}
