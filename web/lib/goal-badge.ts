import { calculateEffortMetrics } from './effort-calculations';
import { parseScheduleDays } from './format';

export interface GoalBadge {
  value: number;   // e.g. 1.5
  label: string;   // e.g. "Ahead"
  color: string;   // hex color
}

/**
 * Compute a consistent momentum/trajectory badge for any goal type.
 * - Target goals: uses calculateEffortMetrics (currentRate / requiredRate) for exact match with detail page.
 * - Outcome goals: uses schedule-aware time-based trajectory.
 * Returns null for project goals, habitual goals, or goals without dates.
 */
export function getGoalBadge(goal: {
  id: number;
  goalType: string;
  startValue: number;
  targetValue: number;
  currentValue: number;
  startDate: string | null;
  targetDate: string | null;
  scheduleDays: string | null;
  flexibilityRule?: string;
}, today: string): GoalBadge | null {
  if (goal.goalType === 'project' || goal.goalType === 'habitual') return null;
  if (!goal.startDate || !goal.targetDate) return null;
  if (today < goal.startDate) return null;

  const range = goal.targetValue - goal.startValue;
  if (range === 0) return null;

  const sched = parseScheduleDays(goal.scheduleDays);
  const effectiveSched = sched.length > 0 ? sched : [0, 1, 2, 3, 4, 5, 6];

  // For target goals, use calculateEffortMetrics for exact consistency
  if (goal.goalType === 'target') {
    const metrics = calculateEffortMetrics(
      goal.startDate, goal.targetDate, effectiveSched,
      goal.targetValue, goal.currentValue, today, goal.startValue
    );
    const isLimit = goal.flexibilityRule === 'limit_avoid';
    let val: number;
    if (isLimit) {
      val = metrics.currentRate > 0 ? metrics.requiredRate / metrics.currentRate : (metrics.requiredRate > 0 ? 2.0 : 1.0);
    } else {
      val = metrics.requiredRate > 0 ? metrics.currentRate / metrics.requiredRate : (metrics.currentRate > 0 ? 2.0 : 1.0);
    }
    val = Math.round(val * 10) / 10;
    const label = val >= 1.05 ? 'Ahead' : val >= 0.95 ? 'On track' : val >= 0.8 ? 'Slightly behind' : 'Behind';
    const color = val >= 0.95 ? '#22C55E' : '#EF4444';
    return { value: val, label, color };
  }

  // Outcome goals: gap from the linear start→target line at "today".
  // Compute where the line says the value should be right now, take the
  // signed gap (positive = ahead of where you should be, in the goal's
  // intended direction), and express it as a 1.0x-centered multiplier
  // bounded to [0, 2]. 1.0 = exactly on the line. A full goal-worth
  // ahead = 2.0, a full goal-worth behind = 0.0. Calendar-day based
  // (schedule days don't make sense for outcome metrics like weight).
  const effectiveToday = today > goal.targetDate ? goal.targetDate : today;
  const startMs = new Date(goal.startDate + 'T00:00:00').getTime();
  const endMs = new Date(goal.targetDate + 'T00:00:00').getTime();
  const todayMs = new Date(effectiveToday + 'T00:00:00').getTime();
  const totalMs = endMs - startMs;
  const timeProgress = totalMs > 0
    ? Math.max(0, Math.min(todayMs - startMs, totalMs)) / totalMs
    : 0;

  const expectedValue = goal.startValue + timeProgress * range;
  const isDecrease = goal.targetValue < goal.startValue;
  const totalDelta = Math.abs(range);
  const gap = isDecrease
    ? expectedValue - goal.currentValue
    : goal.currentValue - expectedValue;
  const gapFrac = totalDelta > 0 ? gap / totalDelta : 0;
  const val = Math.round(Math.max(0, Math.min(2, 1 + gapFrac)) * 10) / 10;
  const label = val >= 1.05 ? 'Ahead' : val >= 0.95 ? 'On track' : val >= 0.8 ? 'Slightly behind' : 'Behind';
  const color = val >= 0.95 ? '#22C55E' : '#EF4444';

  return { value: val, label, color };
}
