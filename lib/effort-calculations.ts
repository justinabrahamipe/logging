export function countScheduledDaysInRange(
  start: string,
  end: string,
  days: number[]
): number {
  if (days.length === 0) return 0;
  const startDate = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  let count = 0;
  const current = new Date(startDate);
  while (current <= endDate) {
    if (days.includes(current.getDay())) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export interface EffortMetrics {
  dailyTarget: number;
  currentRate: number;
  requiredRate: number;
  projectedDate: string | null;
  status: 'ahead' | 'on_track' | 'behind';
  idealProgress: number;
}

export function calculateEffortMetrics(
  startDate: string,
  endDate: string,
  scheduleDays: number[],
  targetValue: number,
  currentValue: number,
  today: string
): EffortMetrics {
  const totalScheduledDays = countScheduledDaysInRange(startDate, endDate, scheduleDays);
  const dailyTarget = totalScheduledDays > 0 ? Math.ceil(targetValue / totalScheduledDays) : targetValue;

  const effectiveToday = today > endDate ? endDate : today < startDate ? startDate : today;
  const elapsedScheduledDays = countScheduledDaysInRange(startDate, effectiveToday, scheduleDays);
  const currentRate = elapsedScheduledDays > 0 ? currentValue / elapsedScheduledDays : 0;

  const remaining = targetValue - currentValue;
  const remainingScheduledDays = countScheduledDaysInRange(effectiveToday, endDate, scheduleDays);
  const requiredRate = remainingScheduledDays > 0 ? Math.ceil(remaining / remainingScheduledDays) : remaining;

  const idealProgress = totalScheduledDays > 0
    ? (elapsedScheduledDays / totalScheduledDays) * targetValue
    : 0;

  let status: 'ahead' | 'on_track' | 'behind';
  const tolerance = dailyTarget * 0.5;
  if (currentValue >= idealProgress + tolerance) {
    status = 'ahead';
  } else if (currentValue >= idealProgress - tolerance) {
    status = 'on_track';
  } else {
    status = 'behind';
  }

  let projectedDate: string | null = null;
  if (currentRate > 0 && remaining > 0) {
    const daysNeeded = Math.ceil(remaining / currentRate);
    let count = 0;
    const current = new Date(effectiveToday + 'T00:00:00');
    while (count < daysNeeded) {
      current.setDate(current.getDate() + 1);
      if (scheduleDays.includes(current.getDay())) count++;
    }
    projectedDate = current.toISOString().split('T')[0];
  } else if (remaining <= 0) {
    projectedDate = effectiveToday;
  }

  return {
    dailyTarget,
    currentRate: Math.round(currentRate * 10) / 10,
    requiredRate,
    projectedDate,
    status,
    idealProgress: Math.round(idealProgress * 10) / 10,
  };
}
