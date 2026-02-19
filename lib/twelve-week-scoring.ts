export type WeekScore = 'exceeded' | 'good' | 'partial' | 'missed';
export type GoalStatus = 'On Track' | 'Ahead' | 'Behind';

export function getWeekScore(actual: number, target: number): WeekScore {
  if (target <= 0) return actual > 0 ? 'exceeded' : 'missed';
  const ratio = actual / target;
  if (ratio >= 1.1) return 'exceeded';
  if (ratio >= 0.85) return 'good';
  if (ratio >= 0.5) return 'partial';
  return 'missed';
}

interface WeeklyTargetForRedist {
  weekNumber: number;
  targetValue: number;
  actualValue: number;
  isOverridden: boolean;
  score: string | null;
}

export function redistributeTargets(
  targets: WeeklyTargetForRedist[],
  currentWeek: number
): { weekNumber: number; targetValue: number }[] {
  // Sum up the deficit from completed weeks (past weeks only)
  let deficit = 0;
  for (const t of targets) {
    if (t.weekNumber < currentWeek && t.score) {
      const missed = t.targetValue - t.actualValue;
      if (missed > 0) deficit += missed;
    }
  }

  if (deficit <= 0) return [];

  // Find future non-overridden weeks to redistribute to
  const futureWeeks = targets.filter(
    (t) => t.weekNumber >= currentWeek && !t.isOverridden && !t.score
  );

  if (futureWeeks.length === 0) return [];

  const extraPerWeek = deficit / futureWeeks.length;

  return futureWeeks.map((t) => ({
    weekNumber: t.weekNumber,
    targetValue: t.targetValue + extraPerWeek,
  }));
}

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
  const week = Math.floor(diffDays / 7) + 1;
  const totalWeeks = getTotalWeeks(startDate, endDate);
  return Math.max(1, Math.min(totalWeeks, week));
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
