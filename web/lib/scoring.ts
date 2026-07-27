import type { TaskForScoring, CompletionForScoring } from '@/lib/types';

export function calculateTaskScore(task: TaskForScoring, completion: CompletionForScoring): number {
  if (task.completionType === 'checkbox') {
    return (completion.completed && (completion.value ?? 0) > 0) ? task.basePoints : 0;
  }

  // At Least scoring: full points at or above target, partial below
  if (task.flexibilityRule === 'at_least' && task.target && task.target > 0) {
    const val = completion.value || 0;
    if (val >= task.target) return task.basePoints;
    return task.basePoints * (val / task.target);
  }

  // Limit/Avoid scoring: under limit = full points, over = negative proportional
  if (task.flexibilityRule === 'limit_avoid' && task.limitValue != null && task.limitValue > 0) {
    const val = completion.value || 0;
    if (val <= task.limitValue) {
      return task.basePoints;
    }
    // Over limit: negative points proportional to how much over
    const overRatio = (val - task.limitValue) / task.limitValue;
    return -task.basePoints * Math.min(overRatio, 1);
  }

  // For count, duration, numeric — score based on progress toward target
  if (task.target && task.target > 0) {
    const progress = Math.min((completion.value || 0) / task.target, 1);
    return task.basePoints * progress;
  }

  // No target, just check if there's a value
  return completion.value && completion.value > 0 ? task.basePoints : 0;
}

export function calculateRemainingPoints(
  task: TaskForScoring,
  completion: CompletionForScoring | null | undefined,
): number {
  const mult = completion?.isHighlighted ? 2 : 1;
  const max = task.basePoints * mult;
  const earned = completion ? calculateTaskScore(task, completion) * mult : 0;
  return Math.max(0, max - Math.max(0, earned));
}

export function calculateDailyScore(
  completions: CompletionForScoring[],
  tasksForDay: TaskForScoring[],
): { actionScore: number; pillarScores: Record<number, number> } {
  if (tasksForDay.length === 0) return { actionScore: 0, pillarScores: {} };

  const HIGHLIGHT_MULTIPLIER = 2;
  const completionMap = new Map<number, CompletionForScoring>();
  for (const c of completions) completionMap.set(c.taskId, c);

  let totalMax = 0;
  let totalEarned = 0;

  // Per-pillar breakdown
  const pillarTasks: Record<number, TaskForScoring[]> = {};
  for (const task of tasksForDay) {
    const pid = task.pillarId ?? 0;
    if (!pillarTasks[pid]) pillarTasks[pid] = [];
    pillarTasks[pid].push(task);
  }

  const pillarScores: Record<number, number> = {};

  for (const [pidStr, tasks] of Object.entries(pillarTasks)) {
    let pillarMax = 0;
    let pillarEarned = 0;
    for (const task of tasks) {
      const completion = completionMap.get(task.id);
      const mult = completion?.isHighlighted ? HIGHLIGHT_MULTIPLIER : 1;
      pillarMax += task.basePoints * mult;
      totalMax += task.basePoints * mult;
      if (completion) {
        const score = calculateTaskScore(task, completion) * mult;
        pillarEarned += score;
        totalEarned += score;
      }
    }
    pillarScores[Number(pidStr)] = pillarMax > 0 ? Math.round((pillarEarned / pillarMax) * 100) : 0;
  }

  const actionScore = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;
  return { actionScore, pillarScores };
}

export type ScoreTier = 'LEGENDARY' | 'Excellent' | 'Good' | 'Decent' | 'Needs Work' | 'Poor';

export function getScoreTier(score: number): ScoreTier {
  if (score >= 95) return 'LEGENDARY';
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Decent';
  if (score >= 30) return 'Needs Work';
  return 'Poor';
}

/** 5-tier progress color: red → orange → amber → emerald → green */
export function getProgressColor(pct: number): string {
  if (pct >= 95) return '#22C55E';
  if (pct >= 75) return '#10B981';
  if (pct >= 50) return '#F59E0B';
  if (pct >= 25) return '#F97316';
  return '#EF4444';
}
