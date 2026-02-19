interface TaskForScoring {
  id: number;
  pillarId: number | null;
  completionType: string;
  target: number | null;
  importance: string;
  basePoints: number;
  flexibilityRule?: string;
  limitValue?: number | null;
}

interface CompletionForScoring {
  taskId: number;
  completed: boolean;
  value: number | null;
}

const IMPORTANCE_MULTIPLIERS: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export function calculateTaskScore(task: TaskForScoring, completion: CompletionForScoring): number {
  const multiplier = IMPORTANCE_MULTIPLIERS[task.importance] || 1;

  if (task.completionType === 'checkbox') {
    return completion.completed ? task.basePoints * multiplier : 0;
  }

  // Limit/Avoid scoring: under limit = full points, over = negative proportional
  if (task.flexibilityRule === 'limit_avoid' && task.limitValue != null && task.limitValue > 0) {
    const val = completion.value || 0;
    if (val <= task.limitValue) {
      return task.basePoints * multiplier;
    }
    // Over limit: negative points proportional to how much over
    const overRatio = (val - task.limitValue) / task.limitValue;
    return -task.basePoints * multiplier * Math.min(overRatio, 1);
  }

  if (task.completionType === 'percentage') {
    const pct = Math.min((completion.value || 0), 100) / 100;
    return task.basePoints * multiplier * pct;
  }

  // For count, duration, numeric — score based on progress toward target
  if (task.target && task.target > 0) {
    const progress = Math.min((completion.value || 0) / task.target, 1);
    return task.basePoints * multiplier * progress;
  }

  // No target, just check if there's a value
  return completion.value && completion.value > 0 ? task.basePoints * multiplier : 0;
}

interface PillarWeight {
  pillarId: number;
  weight: number;
}

export function calculateDailyScore(
  completions: CompletionForScoring[],
  tasksForDay: TaskForScoring[],
  pillarWeights: PillarWeight[]
): { actionScore: number; pillarScores: Record<number, number> } {
  if (tasksForDay.length === 0) {
    return { actionScore: 0, pillarScores: {} };
  }

  // Group tasks by pillar
  const pillarTasks: Record<number, TaskForScoring[]> = {};
  for (const task of tasksForDay) {
    const pid = task.pillarId ?? 0;
    if (!pillarTasks[pid]) pillarTasks[pid] = [];
    pillarTasks[pid].push(task);
  }

  const completionMap = new Map<number, CompletionForScoring>();
  for (const c of completions) {
    completionMap.set(c.taskId, c);
  }

  const pillarScores: Record<number, number> = {};
  const weightMap = new Map<number, number>();
  for (const pw of pillarWeights) {
    weightMap.set(pw.pillarId, pw.weight);
  }

  // Calculate score per pillar
  for (const [pillarIdStr, tasks] of Object.entries(pillarTasks)) {
    const pillarId = Number(pillarIdStr);
    let maxPossible = 0;
    let earned = 0;

    for (const task of tasks) {
      const multiplier = IMPORTANCE_MULTIPLIERS[task.importance] || 1;
      maxPossible += task.basePoints * multiplier;

      const completion = completionMap.get(task.id);
      if (completion) {
        earned += calculateTaskScore(task, completion);
      }
    }

    pillarScores[pillarId] = maxPossible > 0 ? Math.round((earned / maxPossible) * 100) : 0;
  }

  // Weighted average across pillars
  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const [pillarIdStr, score] of Object.entries(pillarScores)) {
    const pillarId = Number(pillarIdStr);
    const weight = weightMap.get(pillarId) || 0;
    totalWeightedScore += score * weight;
    totalWeight += weight;
  }

  const actionScore = totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 0;

  return { actionScore, pillarScores };
}

interface OutcomeForScoring {
  startValue: number;
  targetValue: number;
  currentValue: number;
}

export function calculateProgressScore(outcomes: OutcomeForScoring[]): number {
  if (outcomes.length === 0) return 0;

  let totalProgress = 0;

  for (const outcome of outcomes) {
    const range = Math.abs(outcome.targetValue - outcome.startValue);
    if (range === 0) {
      totalProgress += 100;
      continue;
    }
    const progress = Math.abs(outcome.currentValue - outcome.startValue) / range * 100;
    totalProgress += Math.max(0, Math.min(progress, 100));
  }

  return Math.round(totalProgress / outcomes.length);
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

export function getTierColor(tier: ScoreTier): string {
  switch (tier) {
    case 'LEGENDARY': return '#FFD700';
    case 'Excellent': return '#22C55E';
    case 'Good': return '#3B82F6';
    case 'Decent': return '#F59E0B';
    case 'Needs Work': return '#F97316';
    case 'Poor': return '#EF4444';
  }
}

export function calculateXP(actionScore: number, streakDays: number): { xp: number; streakBonus: number } {
  const baseXP = actionScore; // 1 XP per action score point
  const streakBonus = streakDays >= 3 ? Math.floor(streakDays * 2) : 0;
  return { xp: baseXP + streakBonus, streakBonus };
}

interface LevelInfo {
  level: number;
  title: string;
  currentXp: number;
  xpForNextLevel: number;
  xpProgress: number;
}

const LEVEL_TITLES: Record<number, string> = {
  1: 'Beginner',
  2: 'Novice',
  3: 'Apprentice',
  4: 'Journeyman',
  5: 'Adept',
  6: 'Expert',
  7: 'Master',
  8: 'Grandmaster',
  9: 'Legend',
  10: 'Mythic',
};

export function getLevelInfo(totalXp: number): LevelInfo {
  // Each level requires level * 100 XP
  let xpRemaining = totalXp;
  let level = 1;

  while (xpRemaining >= level * 100 && level < 99) {
    xpRemaining -= level * 100;
    level++;
  }

  const xpForNextLevel = level * 100;
  const title = LEVEL_TITLES[Math.min(level, 10)] || `Level ${level}`;

  return {
    level,
    title,
    currentXp: xpRemaining,
    xpForNextLevel,
    xpProgress: Math.round((xpRemaining / xpForNextLevel) * 100),
  };
}
