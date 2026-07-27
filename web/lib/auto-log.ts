import { db, locationLogs } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function logGoalStatusChange(userId: string, existing: any, body: any): Promise<void> {
  const goalName = existing.name;
  const newName = body.name;
  if (body.status === 'completed') {
    await createAutoLog(userId, `🏆 Goal completed: ${goalName}`);
  } else if (body.status === 'abandoned') {
    await createAutoLog(userId, `🚫 Goal abandoned: ${goalName}`);
  } else if (body.status === 'active' && existing.status !== 'active') {
    await createAutoLog(userId, `🔄 Goal reactivated: ${goalName}`);
  } else if (newName && newName !== goalName) {
    await createAutoLog(userId, `✏️ Goal renamed: ${goalName} → ${newName}`);
  } else if (Object.keys(body).some(k => k !== 'status')) {
    await createAutoLog(userId, `✏️ Goal updated: ${goalName}`);
  }
}

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
