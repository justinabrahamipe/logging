export type GoalStatus = 'On Track' | 'Ahead' | 'Behind';

export function getTotalWeeks(startDate: string, endDate: string): number {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.ceil(diffDays / 7));
}

export function getCurrentWeekNumber(startDate: string, endDate: string): number {
  const start = new Date(startDate + 'T00:00:00');
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 0; // hasn't started yet
  const week = Math.floor(diffDays / 7) + 1;
  const totalWeeks = getTotalWeeks(startDate, endDate);
  return Math.min(totalWeeks, week);
}

export function getGoalStatus(
  current: number,
  target: number,
  weeksPassed: number,
  totalWeeks: number = 12
): GoalStatus {
  if (totalWeeks <= 0 || target <= 0) return 'On Track';
  const expectedProgress = (weeksPassed / totalWeeks) * target;
  const ratio = current / expectedProgress;
  if (ratio >= 1.1) return 'Ahead';
  if (ratio >= 0.85) return 'On Track';
  return 'Behind';
}

export function calculateEndDate(startDate: string): string {
  const date = new Date(startDate + 'T00:00:00');
  date.setDate(date.getDate() + 83);
  return date.toISOString().split('T')[0];
}
