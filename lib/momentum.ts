import { countScheduledDaysInRange } from './effort-calculations';
import type { GoalForMomentum, GoalLogEntry, GoalMomentum, MomentumSummary } from '@/lib/types';

export type { GoalMomentum, MomentumSummary } from '@/lib/types';

/**
 * Calculate momentum for a habitual goal.
 * Momentum = days_hit / days_expected
 * Over a rolling window (last 2 weeks or cycle-to-date, whichever is shorter).
 */
function calculateHabitualMomentum(
  goal: GoalForMomentum,
  logs: GoalLogEntry[],
  today: string
): GoalMomentum | null {
  const scheduleDays: number[] = goal.scheduleDays ? JSON.parse(goal.scheduleDays) : [];
  const startDate = goal.startDate || today;
  const endDate = goal.targetDate || today;

  // Skip goals that haven't started yet
  if (today < startDate) {
    return null;
  }

  const effectiveEnd = today < endDate ? today : endDate;

  // Use cycle-to-date
  const totalExpected = countScheduledDaysInRange(startDate, effectiveEnd, scheduleDays);
  if (totalExpected === 0) {
    return null;
  }

  // Build per-day value totals
  const dayValues = new Map<string, number>();
  for (const log of logs) {
    const date = log.loggedAt.split('T')[0];
    if (log.value > 0) {
      dayValues.set(date, (dayValues.get(date) || 0) + log.value);
    }
  }

  // Count how many scheduled days were hit (proportional when dailyTarget exists)
  const isLimit = goal.flexibilityRule === 'limit_avoid';
  const hasDailyTarget = goal.dailyTarget && goal.dailyTarget > 0 && goal.completionType !== 'checkbox';
  let daysHit = 0;
  const current = new Date(startDate + 'T00:00:00');
  const endD = new Date(effectiveEnd + 'T00:00:00');
  while (current <= endD) {
    const dateStr = current.toISOString().split('T')[0];
    if (scheduleDays.includes(current.getDay())) {
      if (isLimit) {
        // For limit goals: a day is "hit" if value <= limitValue (stayed under)
        const dayLogs = logs.filter(l => l.loggedAt.split('T')[0] === dateStr);
        const dayValue = dayLogs.reduce((sum, l) => sum + l.value, 0);
        if (dayLogs.length > 0 && dayValue <= (goal.limitValue || 0)) daysHit++;
      } else if (hasDailyTarget) {
        // Proportional credit: fraction of dailyTarget completed, capped at 1
        const val = dayValues.get(dateStr) || 0;
        if (val > 0) daysHit += Math.min(val / goal.dailyTarget!, 1);
      } else {
        // Binary: any value > 0 counts as a full hit
        if (dayValues.has(dateStr)) daysHit++;
      }
    }
    current.setDate(current.getDate() + 1);
  }

  // Momentum: adherence ratio
  const momentum = totalExpected > 0 ? daysHit / totalExpected : 1.0;

  // Buffer days = how many more scheduled days you can miss while staying >= 1.0
  const bufferDays = Math.max(0, Math.floor(daysHit - totalExpected));

  const label = momentum >= 1.05 ? `${momentum.toFixed(1)}x` : momentum >= 0.95 ? 'On track' : `${momentum.toFixed(1)}x`;

  return { goalId: goal.id, goalType: goal.goalType, pillarId: goal.pillarId, momentum: Math.round(momentum * 100) / 100, bufferDays, label };
}

/**
 * Calculate momentum for a target goal.
 * Momentum = actual_rate / required_rate
 * Where required_rate is based on linear interpolation through the cycle.
 */
function calculateTargetMomentum(
  goal: GoalForMomentum,
  today: string
): GoalMomentum {
  const scheduleDays: number[] = goal.scheduleDays ? JSON.parse(goal.scheduleDays) : [];
  const startDate = goal.startDate || today;
  const endDate = goal.targetDate || today;

  if (today < startDate) {
    return { goalId: goal.id, goalType: goal.goalType, pillarId: goal.pillarId, momentum: 1.0, bufferDays: 0, label: 'Not started' };
  }

  const effectiveToday = today > endDate ? endDate : today;
  const totalDays = scheduleDays.length > 0
    ? countScheduledDaysInRange(startDate, endDate, scheduleDays)
    : Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1);

  const elapsedDays = scheduleDays.length > 0
    ? countScheduledDaysInRange(startDate, effectiveToday, scheduleDays)
    : Math.max(1, Math.ceil((new Date(effectiveToday).getTime() - new Date(startDate).getTime()) / 86400000) + 1);

  if (totalDays === 0 || elapsedDays === 0) {
    return { goalId: goal.id, goalType: goal.goalType, pillarId: goal.pillarId, momentum: 1.0, bufferDays: 0, label: 'On track' };
  }

  // Where you should be (linear)
  const isDecrease = goal.targetValue < goal.startValue;
  const totalDelta = Math.abs(goal.targetValue - goal.startValue);
  const expectedProgress = (elapsedDays / totalDays) * totalDelta;
  // Where you are (negative when moving in wrong direction)
  const actualProgress = isDecrease
    ? goal.startValue - goal.currentValue
    : goal.currentValue - goal.startValue;

  const isLimit = goal.flexibilityRule === 'limit_avoid';
  // For limit goals: using less than expected = ahead, so invert the ratio
  const momentum = isLimit
    ? (actualProgress > 0 ? expectedProgress / actualProgress : (expectedProgress > 0 ? 2.0 : 1.0))
    : (expectedProgress > 0 ? actualProgress / expectedProgress : (actualProgress > 0 ? 2.0 : 1.0));

  // Buffer: how many more scheduled days can you skip
  const remainingDays = totalDays - elapsedDays;
  const remainingTarget = totalDelta - actualProgress;
  const dailyRate = elapsedDays > 0 ? actualProgress / elapsedDays : 0;
  const requiredRate = remainingDays > 0 ? remainingTarget / remainingDays : remainingTarget;
  const bufferDays = dailyRate > 0 && requiredRate > 0
    ? Math.max(0, Math.floor(remainingDays - (remainingTarget / dailyRate)))
    : 0;

  const label = momentum >= 1.05 ? `${momentum.toFixed(1)}x` : momentum >= 0.95 ? 'On track' : `${momentum.toFixed(1)}x`;

  return { goalId: goal.id, goalType: goal.goalType, pillarId: goal.pillarId, momentum: Math.round(momentum * 100) / 100, bufferDays, label };
}

export interface GoalTrajectory {
  goalId: number;
  pillarId: number | null;
  trajectory: number; // 1.0 = on pace, >1 = ahead, <1 = behind
  label: string;
}

export interface TrajectorySummary {
  overall: number;
  goals: GoalTrajectory[];
}

/**
 * Calculate trajectory for outcome goals.
 * Trajectory = actual progress % / expected progress % (linear through cycle).
 * Outcome goals are not fully in your control, so we call this "trajectory" not "momentum".
 */
export function calculateTrajectory(
  goals: GoalForMomentum[],
  today: string
): TrajectorySummary {
  const outcomeGoals = goals.filter(g => g.goalType === 'outcome');
  if (outcomeGoals.length === 0) {
    return { overall: 1.0, goals: [] };
  }

  const results: GoalTrajectory[] = [];

  for (const goal of outcomeGoals) {
    const startDate = goal.startDate || today;
    const endDate = goal.targetDate || today;

    if (today < startDate) {
      results.push({ goalId: goal.id, pillarId: goal.pillarId, trajectory: 1.0, label: 'Not started' });
      continue;
    }

    const totalMs = new Date(endDate).getTime() - new Date(startDate).getTime();
    const elapsedMs = new Date(today > endDate ? endDate : today).getTime() - new Date(startDate).getTime();

    if (totalMs <= 0) {
      results.push({ goalId: goal.id, pillarId: goal.pillarId, trajectory: 1.0, label: 'On track' });
      continue;
    }

    const timeProgress = elapsedMs / totalMs;
    const range = goal.targetValue - goal.startValue;
    if (range === 0) {
      results.push({ goalId: goal.id, pillarId: goal.pillarId, trajectory: 1.0, label: 'Complete' });
      continue;
    }

    // Expected value today based on linear interpolation from start to target
    const expectedValue = goal.startValue + range * timeProgress;
    // How far ahead/behind relative to the total range
    // For increase goals (range > 0): current > expected = ahead (positive)
    // For decrease goals (range < 0): current < expected = ahead (positive)
    const deviation = (goal.currentValue - expectedValue) / range;
    // Convert to trajectory score: 1.0 = on pace, >1 = ahead, <1 = behind
    const trajectory = Math.max(0, 1.0 + deviation);
    const label = trajectory >= 1.05 ? `${trajectory.toFixed(1)}x` : trajectory >= 0.95 ? 'On track' : `${trajectory.toFixed(1)}x`;

    results.push({ goalId: goal.id, pillarId: goal.pillarId, trajectory: Math.round(trajectory * 100) / 100, label });
  }

  const overall = results.length > 0
    ? Math.round((results.reduce((s, g) => s + g.trajectory, 0) / results.length) * 100) / 100
    : 1.0;

  return { overall, goals: results };
}

/**
 * Calculate momentum for all goals and aggregate by pillar.
 */
export function calculateMomentum(
  goals: GoalForMomentum[],
  logs: GoalLogEntry[],
  pillarWeights: { pillarId: number; weight: number }[],
  today: string
): MomentumSummary {
  if (goals.length === 0) {
    return { overall: 1.0, pillarMomentum: {}, goals: [] };
  }

  const logsByGoal = new Map<number, GoalLogEntry[]>();
  for (const log of logs) {
    if (!logsByGoal.has(log.outcomeId)) logsByGoal.set(log.outcomeId, []);
    logsByGoal.get(log.outcomeId)!.push(log);
  }

  const goalResults: GoalMomentum[] = [];

  for (const goal of goals) {
    // Skip outcome goals — they have trajectory, not momentum
    if (goal.goalType === 'outcome') continue;

    let result: GoalMomentum | null;

    switch (goal.goalType) {
      case 'habitual':
        result = calculateHabitualMomentum(goal, logsByGoal.get(goal.id) || [], today);
        break;
      case 'target':
      default:
        // target + legacy 'effort' type
        result = calculateTargetMomentum(goal, today);
    }

    if (result) goalResults.push(result);
  }

  // Aggregate by pillar
  const pillarGoals = new Map<number, GoalMomentum[]>();
  for (const g of goalResults) {
    const pid = g.pillarId ?? 0;
    if (!pillarGoals.has(pid)) pillarGoals.set(pid, []);
    pillarGoals.get(pid)!.push(g);
  }

  const weightMap = new Map<number, number>();
  for (const pw of pillarWeights) {
    weightMap.set(pw.pillarId, pw.weight);
  }

  const pillarMomentum: Record<number, number> = {};
  let totalWeightedMomentum = 0;
  let totalWeight = 0;

  for (const [pid, pGoals] of pillarGoals) {
    const avg = pGoals.reduce((s, g) => s + g.momentum, 0) / pGoals.length;
    pillarMomentum[pid] = Math.round(avg * 100) / 100;

    const weight = weightMap.get(pid) || 1;
    totalWeightedMomentum += avg * weight;
    totalWeight += weight;
  }

  const overall = totalWeight > 0
    ? Math.round((totalWeightedMomentum / totalWeight) * 100) / 100
    : 1.0;

  return { overall, pillarMomentum, goals: goalResults };
}
