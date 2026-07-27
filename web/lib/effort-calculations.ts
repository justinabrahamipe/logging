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

import type { EffortMetrics } from '@/lib/types';
export type { EffortMetrics } from '@/lib/types';

export function calculateEffortMetrics(
  startDate: string,
  endDate: string,
  scheduleDays: number[],
  targetValue: number,
  currentValue: number,
  today: string,
  startValue: number = 0
): EffortMetrics {
  const isDecrease = targetValue < startValue;
  const totalDelta = Math.abs(targetValue - startValue);
  const currentDelta = isDecrease
    ? Math.max(0, startValue - currentValue)
    : Math.max(0, currentValue - startValue);

  const totalScheduledDays = countScheduledDaysInRange(startDate, endDate, scheduleDays);
  const dailyTarget = totalScheduledDays > 0 ? Math.ceil(totalDelta / totalScheduledDays) : totalDelta;

  const isFuture = today < startDate;
  const effectiveToday = today > endDate ? endDate : isFuture ? startDate : today;
  const elapsedScheduledDays = isFuture ? 0 : countScheduledDaysInRange(startDate, effectiveToday, scheduleDays);
  const currentRate = elapsedScheduledDays > 0 ? currentDelta / elapsedScheduledDays : 0;

  const remaining = totalDelta - currentDelta;
  let remainingScheduledDays: number;
  if (isFuture) {
    // Goal hasn't started — all days are remaining, required = dailyTarget
    remainingScheduledDays = totalScheduledDays;
  } else {
    // Count from tomorrow (today's work is already reflected in currentDelta)
    const tomorrow = new Date(effectiveToday + 'T12:00:00');
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    remainingScheduledDays = countScheduledDaysInRange(tomorrowStr, endDate, scheduleDays);
  }
  const requiredRate = remainingScheduledDays > 0 ? Math.ceil(remaining / remainingScheduledDays) : remaining;

  const idealProgress = totalScheduledDays > 0
    ? (elapsedScheduledDays / totalScheduledDays) * totalDelta
    : 0;

  let status: 'ahead' | 'on_track' | 'behind';
  if (remaining <= 0) {
    status = 'ahead';
  } else if (isFuture) {
    status = 'on_track';
  } else if (currentRate >= requiredRate) {
    status = 'ahead';
  } else if (currentRate >= requiredRate * 0.8) {
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
