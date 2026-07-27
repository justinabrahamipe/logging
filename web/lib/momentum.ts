import { countScheduledDaysInRange } from './effort-calculations';
import { parseScheduleDays } from '@/lib/format';
import type { GoalForMomentum, GoalLogEntry, GoalMomentum, MomentumSummary } from '@/lib/types';

export type { GoalMomentum, MomentumSummary } from '@/lib/types';

/**
 * Calculate momentum for a target goal.
 * Momentum = actual_rate / required_rate
 * Where required_rate is based on linear interpolation through the cycle.
 */
function calculateTargetMomentum(
  goal: GoalForMomentum,
  today: string
): GoalMomentum {
  const scheduleDays: number[] = parseScheduleDays(goal.scheduleDays);
  const startDate = goal.startDate || today;
  const endDate = goal.targetDate || today;

  if (today < startDate) {
    return { goalId: goal.id, goalType: goal.goalType, pillarId: goal.pillarId, momentum: 1.0, bufferDays: 0, label: 'Not started' };
  }

  const effectiveToday = today > endDate ? endDate : today;
  const totalDays = scheduleDays.length > 0
    ? countScheduledDaysInRange(startDate, endDate, scheduleDays)
    : Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1);

  // Use yesterday for elapsed calculation — today's work is in progress,
  // so comparing against today's expected would penalize you mid-day
  const yesterday = new Date(effectiveToday + 'T12:00:00');
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const elapsedEnd = yesterdayStr >= startDate ? yesterdayStr : startDate;

  const elapsedDays = scheduleDays.length > 0
    ? countScheduledDaysInRange(startDate, elapsedEnd, scheduleDays)
    : Math.max(1, Math.ceil((new Date(elapsedEnd).getTime() - new Date(startDate).getTime()) / 86400000) + 1);

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
    const scheduleDays: number[] = parseScheduleDays(goal.scheduleDays);

    if (today < startDate) {
      results.push({ goalId: goal.id, pillarId: goal.pillarId, trajectory: 1.0, label: 'Not started' });
      continue;
    }

    const effectiveEnd = today > endDate ? endDate : today;
    // Use yesterday for elapsed — today's work is in progress
    const yd = new Date(effectiveEnd + 'T12:00:00');
    yd.setDate(yd.getDate() - 1);
    const ydStr = yd.toISOString().split('T')[0];
    const elapsedEnd2 = ydStr >= startDate ? ydStr : startDate;

    // Use scheduled days if available, otherwise calendar days
    let timeProgress: number;
    if (scheduleDays.length > 0) {
      const totalDays = countScheduledDaysInRange(startDate, endDate, scheduleDays);
      const elapsedDays = countScheduledDaysInRange(startDate, elapsedEnd2, scheduleDays);
      if (totalDays <= 0 || elapsedDays <= 0) {
        results.push({ goalId: goal.id, pillarId: goal.pillarId, trajectory: 1.0, label: 'On track' });
        continue;
      }
      timeProgress = elapsedDays / totalDays;
    } else {
      const totalMs = new Date(endDate).getTime() - new Date(startDate).getTime();
      const elapsedMs = new Date(elapsedEnd2).getTime() - new Date(startDate).getTime();
      if (totalMs <= 0 || elapsedMs <= 0) {
        results.push({ goalId: goal.id, pillarId: goal.pillarId, trajectory: 1.0, label: 'On track' });
        continue;
      }
      timeProgress = elapsedMs / totalMs;
    }
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
    const trajectory = 1.0 + deviation;
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
    if (goal.goalType !== 'target') continue;
    const result = calculateTargetMomentum(goal, today);
    if (result) goalResults.push(result);
  }

  // Aggregate by pillar (equal weight)
  const pillarGoals = new Map<number, GoalMomentum[]>();
  for (const g of goalResults) {
    const pid = g.pillarId ?? 0;
    if (!pillarGoals.has(pid)) pillarGoals.set(pid, []);
    pillarGoals.get(pid)!.push(g);
  }

  const pillarMomentum: Record<number, number> = {};
  let totalWeightedMomentum = 0;
  let totalWeight = 0;

  for (const [pid, pGoals] of pillarGoals) {
    const avg = pGoals.reduce((s, g) => s + g.momentum, 0) / pGoals.length;
    pillarMomentum[pid] = Math.round(avg * 100) / 100;

    totalWeightedMomentum += avg;
    totalWeight += 1;
  }

  const overall = totalWeight > 0
    ? Math.round((totalWeightedMomentum / totalWeight) * 100) / 100
    : 1.0;

  return { overall, pillarMomentum, goals: goalResults };
}
