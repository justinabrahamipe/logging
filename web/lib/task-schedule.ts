import { taskSchedules } from '@/lib/db';
import { getTodayString, parseCustomDays } from '@/lib/format';

/**
 * Determines if a schedule should generate a task for the given date.
 */
function isScheduleForExactDate(schedule: typeof taskSchedules.$inferSelect, dateStr: string): boolean {
  // If schedule has a startDate, don't generate before it
  if (schedule.startDate && dateStr < schedule.startDate) return false;

  const date = new Date(dateStr + 'T12:00:00');
  const dayOfWeek = date.getDay(); // 0=Sunday

  if (schedule.frequency === 'adhoc') {
    const effectiveDate = schedule.startDate || (schedule.createdAt ? new Date(schedule.createdAt).toISOString().split('T')[0] : null);
    return effectiveDate != null && dateStr === effectiveDate;
  }

  if (schedule.frequency === 'daily') return true;

  // Backwards compat: treat legacy 'weekly' as Monday
  if (schedule.frequency === 'weekly') {
    return dayOfWeek === 1;
  }

  if (schedule.frequency === 'custom' && schedule.customDays) {
    try {
      const days: number[] = parseCustomDays(schedule.customDays);
      if (!days.includes(dayOfWeek)) return false;
      // Check week interval if set (every N weeks)
      if (schedule.repeatInterval && schedule.repeatInterval > 7) {
        // Use startDate as anchor; fall back to createdAt
        let anchorStr: string | null = schedule.startDate || null;
        if (!anchorStr && schedule.createdAt) {
          const cd = new Date(schedule.createdAt);
          anchorStr = `${cd.getFullYear()}-${String(cd.getMonth() + 1).padStart(2, '0')}-${String(cd.getDate()).padStart(2, '0')}`;
        }
        if (!anchorStr) return true;
        const diffMs = date.getTime() - new Date(anchorStr + 'T12:00:00').getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        const weekInterval = Math.round(schedule.repeatInterval / 7);
        const diffWeeks = Math.floor(diffDays / 7);
        return diffWeeks >= 0 && diffWeeks % weekInterval === 0;
      }
      return true;
    } catch {
      return true;
    }
  }

  if (schedule.frequency === 'monthly' && schedule.customDays) {
    try {
      const days: number[] = parseCustomDays(schedule.customDays);
      const dayOfMonth = date.getDate();
      if (!days.includes(dayOfMonth)) return false;
      if (schedule.repeatInterval && schedule.repeatInterval > 1) {
        // Use startDate as anchor; fall back to createdAt
        let anchorDate: Date | null = schedule.startDate ? new Date(schedule.startDate + 'T12:00:00') : null;
        if (!anchorDate && schedule.createdAt) anchorDate = new Date(schedule.createdAt);
        if (!anchorDate) return true;
        const monthsDiff = (date.getFullYear() - anchorDate.getFullYear()) * 12 + (date.getMonth() - anchorDate.getMonth());
        return monthsDiff >= 0 && monthsDiff % schedule.repeatInterval === 0;
      }
      return true;
    } catch {
      return true;
    }
  }

  if (schedule.frequency === 'interval' && schedule.repeatInterval && schedule.repeatInterval > 0) {
    // Use startDate as anchor; fall back to createdAt
    let anchorStr: string | null = schedule.startDate || null;
    if (!anchorStr && schedule.createdAt) {
      const cd = new Date(schedule.createdAt);
      anchorStr = `${cd.getFullYear()}-${String(cd.getMonth() + 1).padStart(2, '0')}-${String(cd.getDate()).padStart(2, '0')}`;
    }
    if (!anchorStr) return true;
    const diffMs = date.getTime() - new Date(anchorStr + 'T12:00:00').getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays % schedule.repeatInterval === 0;
  }

  return true;
}

export function isOverdueAdhocSchedule(schedule: typeof taskSchedules.$inferSelect, todayStr: string): boolean {
  return schedule.frequency === 'adhoc' && !schedule.goalId && !!schedule.startDate && schedule.startDate < todayStr;
}

export function isScheduleForDate(schedule: typeof taskSchedules.$inferSelect, dateStr: string): boolean {
  if (isScheduleForExactDate(schedule, dateStr)) return true;
  // Include overdue adhoc schedules on today only
  const todayStr = getTodayString();
  if (dateStr === todayStr && schedule.frequency === 'adhoc' && !schedule.goalId && schedule.startDate && schedule.startDate < todayStr) return true;
  return false;
}

export { isScheduleForExactDate };
