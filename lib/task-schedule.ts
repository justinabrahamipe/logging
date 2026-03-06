import { tasks } from '@/lib/db';

function isTaskForExactDate(task: typeof tasks.$inferSelect, dateStr: string): boolean {
  // If task has a startDate, don't show before it
  if (task.startDate && dateStr < task.startDate) return false;

  const date = new Date(dateStr + 'T12:00:00');
  const dayOfWeek = date.getDay(); // 0=Sunday

  if (task.frequency === 'adhoc') {
    const createdDate = task.createdAt ? new Date(task.createdAt).toISOString().split('T')[0] : null;
    return createdDate === dateStr;
  }

  if (task.frequency === 'daily') return true;

  // Backwards compat: treat legacy 'weekly' as Monday
  if (task.frequency === 'weekly') {
    return dayOfWeek === 1;
  }

  if (task.frequency === 'custom' && task.customDays) {
    try {
      const days: number[] = JSON.parse(task.customDays);
      if (!days.includes(dayOfWeek)) return false;
      // Check week interval if set (every N weeks)
      if (task.repeatInterval && task.repeatInterval > 7) {
        const createdDate = task.createdAt ? new Date(task.createdAt) : null;
        if (!createdDate) return true;
        const diffMs = date.getTime() - new Date(createdDate.toISOString().split('T')[0] + 'T12:00:00').getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        const weekInterval = Math.round(task.repeatInterval / 7);
        const diffWeeks = Math.floor(diffDays / 7);
        return diffWeeks >= 0 && diffWeeks % weekInterval === 0;
      }
      return true;
    } catch {
      return true;
    }
  }

  if (task.frequency === 'monthly' && task.customDays) {
    try {
      const days: number[] = JSON.parse(task.customDays);
      const dayOfMonth = date.getDate();
      if (!days.includes(dayOfMonth)) return false;
      if (task.repeatInterval && task.repeatInterval > 1) {
        const createdDate = task.createdAt ? new Date(task.createdAt) : null;
        if (!createdDate) return true;
        const monthsDiff = (date.getFullYear() - createdDate.getFullYear()) * 12 + (date.getMonth() - createdDate.getMonth());
        return monthsDiff >= 0 && monthsDiff % task.repeatInterval === 0;
      }
      return true;
    } catch {
      return true;
    }
  }

  if (task.frequency === 'interval' && task.repeatInterval && task.repeatInterval > 0) {
    const createdDate = task.createdAt ? new Date(task.createdAt) : null;
    if (!createdDate) return true;
    const diffMs = date.getTime() - new Date(createdDate.toISOString().split('T')[0] + 'T12:00:00').getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays % task.repeatInterval === 0;
  }

  return true;
}

export function isTaskForDate(task: typeof tasks.$inferSelect, dateStr: string): boolean {
  if (isTaskForExactDate(task, dateStr)) return true;

  const before = task.toleranceBefore || 0;
  const after = task.toleranceAfter || 0;
  if (before <= 0 && after <= 0) return false;

  const date = new Date(dateStr + 'T12:00:00');
  for (let offset = -before; offset <= after; offset++) {
    if (offset === 0) continue;
    const nearby = new Date(date);
    nearby.setDate(nearby.getDate() + offset);
    const nearbyStr = nearby.toISOString().split('T')[0];
    if (isTaskForExactDate(task, nearbyStr)) return true;
  }
  return false;
}
