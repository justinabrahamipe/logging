interface TaskForScoring {
  id: number;
  pillarId: number | null;
  completionType: string;
  target: number | null;
  basePoints: number;
  flexibilityRule?: string;
  limitValue?: number | null;
}

interface CompletionForScoring {
  taskId: number;
  completed: boolean;
  value: number | null;
  isHighlighted?: boolean;
}

export function calculateTaskScore(task: TaskForScoring, completion: CompletionForScoring): number {
  if (task.completionType === 'checkbox') {
    return completion.completed ? task.basePoints : 0;
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

  // Distribute remaining weight evenly among pillars with 0 weight
  const assignedWeight = pillarWeights.reduce((sum, pw) => sum + (pw.weight || 0), 0);
  const unweighted = pillarWeights.filter(pw => !pw.weight || pw.weight === 0);
  const remainingWeight = Math.max(0, 100 - assignedWeight);
  const autoWeight = unweighted.length > 0 ? remainingWeight / unweighted.length : 0;

  for (const pw of pillarWeights) {
    weightMap.set(pw.pillarId, pw.weight || autoWeight);
  }

  // Calculate score per pillar (highlighted tasks get 1.5x weight)
  const HIGHLIGHT_MULTIPLIER = 2;
  for (const [pillarIdStr, tasks] of Object.entries(pillarTasks)) {
    const pillarId = Number(pillarIdStr);
    let maxPossible = 0;
    let earned = 0;

    for (const task of tasks) {
      const completion = completionMap.get(task.id);
      const multiplier = completion?.isHighlighted ? HIGHLIGHT_MULTIPLIER : 1;
      maxPossible += task.basePoints * multiplier;

      if (completion) {
        earned += calculateTaskScore(task, completion) * multiplier;
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
