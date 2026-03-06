import { countScheduledDaysInRange } from './effort-calculations';

interface GoalForMomentum {
  id: number;
  goalType: string; // 'habitual' | 'target' | 'outcome'
  pillarId: number | null;
  targetValue: number;
  startValue: number;
  currentValue: number;
  startDate: string | null;
  targetDate: string | null;
  scheduleDays: string | null; // JSON array
  tolerance: number | null; // allowed misses per week (habitual)
}

interface GoalLogEntry {
  outcomeId: number;
  value: number;
  loggedAt: string; // ISO timestamp or YYYY-MM-DD
}

export interface GoalMomentum {
  goalId: number;
  goalType: string;
  pillarId: number | null;
  momentum: number; // 1.0 = on pace, >1 = ahead, <1 = behind
  bufferDays: number; // how many days you can miss and stay >= 1.0
  label: string; // "1.3x" or "On track" or "Behind"
}

export interface MomentumSummary {
  overall: number; // weighted momentum across all goals
  pillarMomentum: Record<number, number>; // pillarId -> momentum
  goals: GoalMomentum[];
}

/**
 * Calculate momentum for a habitual goal.
 * Momentum = (days_hit + tolerance_remaining) / days_expected
 * Over a rolling window (last 2 weeks or cycle-to-date, whichever is shorter).
 */
function calculateHabitualMomentum(
  goal: GoalForMomentum,
  logs: GoalLogEntry[],
  today: string
): GoalMomentum {
  const scheduleDays: number[] = goal.scheduleDays ? JSON.parse(goal.scheduleDays) : [];
  const startDate = goal.startDate || today;
  const endDate = goal.targetDate || today;
  const effectiveStart = startDate > today ? today : startDate;
  const effectiveEnd = today < endDate ? today : endDate;

  // Use cycle-to-date
  const totalExpected = countScheduledDaysInRange(effectiveStart, effectiveEnd, scheduleDays);
  if (totalExpected === 0) {
    return { goalId: goal.id, goalType: goal.goalType, pillarId: goal.pillarId, momentum: 1.0, bufferDays: 0, label: 'On track' };
  }

  // Count days where a log entry exists (value > 0)
  const logDates = new Set<string>();
  for (const log of logs) {
    const date = log.loggedAt.split('T')[0];
    if (log.value > 0) logDates.add(date);
  }

  // Count how many scheduled days were hit
  let daysHit = 0;
  const current = new Date(effectiveStart + 'T00:00:00');
  const endD = new Date(effectiveEnd + 'T00:00:00');
  while (current <= endD) {
    const dateStr = current.toISOString().split('T')[0];
    if (scheduleDays.includes(current.getDay()) && logDates.has(dateStr)) {
      daysHit++;
    }
    current.setDate(current.getDate() + 1);
  }

  // Weekly tolerance: allowed misses per week
  const weeksToDDate = Math.max(1, Math.ceil(totalExpected / (scheduleDays.length || 1)));
  const totalAllowedMisses = (goal.tolerance || 0) * weeksToDDate;
  const missed = totalExpected - daysHit;
  const toleranceRemaining = Math.max(0, totalAllowedMisses - missed);

  // Momentum: effective adherence ratio
  // If you've hit all days + have tolerance left, momentum > 1.0
  const effectiveHits = daysHit + toleranceRemaining;
  const momentum = totalExpected > 0 ? effectiveHits / totalExpected : 1.0;

  // Buffer days = how many more scheduled days you can miss while staying >= 1.0
  const bufferDays = Math.max(0, Math.floor(effectiveHits - totalExpected));

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
  const expectedProgress = (elapsedDays / totalDays) * goal.targetValue;
  // Where you are
  const actualProgress = goal.currentValue - goal.startValue;

  const momentum = expectedProgress > 0 ? actualProgress / expectedProgress : (actualProgress > 0 ? 2.0 : 1.0);

  // Buffer: how many more scheduled days can you skip
  const remainingDays = totalDays - elapsedDays;
  const remainingTarget = goal.targetValue - goal.currentValue;
  const dailyRate = elapsedDays > 0 ? actualProgress / elapsedDays : 0;
  const requiredRate = remainingDays > 0 ? remainingTarget / remainingDays : remainingTarget;
  const bufferDays = dailyRate > 0 && requiredRate > 0
    ? Math.max(0, Math.floor(remainingDays - (remainingTarget / dailyRate)))
    : 0;

  const label = momentum >= 1.05 ? `${momentum.toFixed(1)}x` : momentum >= 0.95 ? 'On track' : `${momentum.toFixed(1)}x`;

  return { goalId: goal.id, goalType: goal.goalType, pillarId: goal.pillarId, momentum: Math.round(momentum * 100) / 100, bufferDays, label };
}

/**
 * Calculate momentum for an outcome goal.
 * Momentum = actual progress % / expected progress % (linear through cycle).
 */
function calculateOutcomeMomentum(
  goal: GoalForMomentum,
  today: string
): GoalMomentum {
  const startDate = goal.startDate || today;
  const endDate = goal.targetDate || today;

  if (today < startDate) {
    return { goalId: goal.id, goalType: goal.goalType, pillarId: goal.pillarId, momentum: 1.0, bufferDays: 0, label: 'Not started' };
  }

  const totalMs = new Date(endDate).getTime() - new Date(startDate).getTime();
  const elapsedMs = new Date(today > endDate ? endDate : today).getTime() - new Date(startDate).getTime();

  if (totalMs <= 0) {
    return { goalId: goal.id, goalType: goal.goalType, pillarId: goal.pillarId, momentum: 1.0, bufferDays: 0, label: 'On track' };
  }

  const timeProgress = elapsedMs / totalMs;
  const range = Math.abs(goal.targetValue - goal.startValue);
  if (range === 0) {
    return { goalId: goal.id, goalType: goal.goalType, pillarId: goal.pillarId, momentum: 1.0, bufferDays: 0, label: 'Complete' };
  }

  const valueProgress = Math.abs(goal.currentValue - goal.startValue) / range;
  const expectedProgress = timeProgress;

  const momentum = expectedProgress > 0 ? valueProgress / expectedProgress : (valueProgress > 0 ? 2.0 : 1.0);

  const label = momentum >= 1.05 ? `${momentum.toFixed(1)}x` : momentum >= 0.95 ? 'On track' : `${momentum.toFixed(1)}x`;

  return { goalId: goal.id, goalType: goal.goalType, pillarId: goal.pillarId, momentum: Math.round(momentum * 100) / 100, bufferDays: 0, label };
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
    let result: GoalMomentum;
    const goalLogs = logsByGoal.get(goal.id) || [];

    switch (goal.goalType) {
      case 'habitual':
        result = calculateHabitualMomentum(goal, goalLogs, today);
        break;
      case 'target':
        result = calculateTargetMomentum(goal, today);
        break;
      case 'outcome':
        result = calculateOutcomeMomentum(goal, today);
        break;
      default:
        // Legacy 'effort' type — treat as target
        result = calculateTargetMomentum(goal, today);
    }

    goalResults.push(result);
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
