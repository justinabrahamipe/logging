export interface AnalyticsGoal {
  id: number;
  name: string;
  targetValue: number;
  currentValue: number;
  startValue?: number;
  goalType?: string;
  /** For habitual goals: adherence % (0-100) based on completed/expected days so far */
  adherence?: number | null;
  /** For habitual goals: max possible % if perfect from now on = (completed + remaining) / total */
  maxPossible?: number | null;
}

export type PaceIndicator = 'ahead' | 'on_track' | 'behind';

export interface CycleAnalytics {
  overallCompletion: number;
  pace: PaceIndicator;
  paceScore: number; // 0-2 scale, 1.0 = on track
  projectedCompletion: number;
}

/**
 * Compute cycle analytics with composite pace from per-goal-type metrics.
 *
 * @param momentum - overall momentum for target goals (1.0 = on track), null if no target goals
 * @param trajectory - overall trajectory for outcome goals (1.0 = on track), null if no outcome goals
 */
export function computeCycleAnalytics(
  goals: AnalyticsGoal[],
  currentWeek: number,
  totalWeeks: number,
  momentum: number | null,
  trajectory: number | null
): CycleAnalytics {
  if (goals.length === 0) {
    return { overallCompletion: 0, pace: 'on_track', paceScore: 1.0, projectedCompletion: 0 };
  }

  // Calculate per-goal completion, then average
  let totalCompletion = 0;
  let totalProjected = 0;
  let countable = 0;

  const weeksElapsed = Math.max(1, currentWeek - 1);

  // Collect per-type pace scores
  const paceComponents: number[] = [];

  // Habitual goals: adherence-based
  const habitualGoals = goals.filter(g => g.goalType === 'habitual' && g.adherence != null);
  if (habitualGoals.length > 0) {
    const avgAdherence = habitualGoals.reduce((s, g) => s + (g.adherence ?? 0), 0) / habitualGoals.length;
    // Convert adherence to pace scale: 100% adherence = 1.0, 85% = 0.85, etc.
    paceComponents.push(avgAdherence / 100);
  }

  // Target goals: use momentum (already on 1.0 = on track scale)
  if (momentum !== null) {
    paceComponents.push(momentum);
  }

  // Outcome goals: use trajectory (already on 1.0 = on track scale)
  if (trajectory !== null) {
    paceComponents.push(trajectory);
  }

  for (const g of goals) {
    const isHabitual = g.goalType === 'habitual';

    if (isHabitual && g.adherence != null) {
      totalCompletion += Math.max(0, Math.min(g.adherence, 100));
      totalProjected += Math.max(0, Math.min(g.maxPossible ?? g.adherence, 100));
      countable++;
    } else {
      const start = g.startValue || 0;
      const range = g.targetValue - start;
      if (range === 0) {
        totalCompletion += 100;
        totalProjected += 100;
        countable++;
        continue;
      }
      const progress = ((g.currentValue - start) / range) * 100;
      const clampedProgress = Math.max(0, Math.min(progress, 100));
      totalCompletion += clampedProgress;
      const ratePerWeek = clampedProgress / weeksElapsed;
      totalProjected += Math.min(100, ratePerWeek * totalWeeks);
      countable++;
    }
  }

  const overallCompletion = countable > 0 ? totalCompletion / countable : 0;

  // Composite pace from momentum, trajectory, and adherence
  let paceScore: number;
  if (paceComponents.length > 0) {
    paceScore = paceComponents.reduce((s, v) => s + v, 0) / paceComponents.length;
  } else {
    // Fallback: simple linear pace
    const expectedPct = totalWeeks > 0 ? (Math.max(0, currentWeek - 1) / totalWeeks) * 100 : 0;
    paceScore = expectedPct > 0 ? overallCompletion / expectedPct : 1;
  }

  const pace: PaceIndicator = paceScore >= 1.1 ? 'ahead' : paceScore >= 0.85 ? 'on_track' : 'behind';

  const projectedCompletion = countable > 0 ? totalProjected / countable : 0;

  return { overallCompletion: Math.round(overallCompletion), pace, paceScore: Math.round(paceScore * 100) / 100, projectedCompletion };
}
