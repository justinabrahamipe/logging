export interface AnalyticsGoal {
  id: number;
  name: string;
  targetValue: number;
  currentValue: number;
  startValue?: number;
  goalType?: string;
}

export type PaceIndicator = 'ahead' | 'on_track' | 'behind';

export interface CycleAnalytics {
  overallCompletion: number;
  pace: PaceIndicator;
  projectedCompletion: number;
}

export function computeCycleAnalytics(
  goals: AnalyticsGoal[],
  currentWeek: number,
  totalWeeks: number
): CycleAnalytics {
  if (goals.length === 0) {
    return { overallCompletion: 0, pace: 'on_track', projectedCompletion: 0 };
  }

  // Calculate per-goal completion, then average
  let totalCompletion = 0;
  let countable = 0;

  for (const g of goals) {
    const start = g.startValue || 0;
    const range = g.targetValue - start;
    if (range === 0) {
      totalCompletion += 100;
      countable++;
      continue;
    }
    const progress = ((g.currentValue - start) / range) * 100;
    totalCompletion += Math.max(0, Math.min(progress, 100));
    countable++;
  }

  const overallCompletion = countable > 0 ? totalCompletion / countable : 0;

  // Expected completion at this week
  const expectedPct = totalWeeks > 0 ? (Math.max(0, currentWeek - 1) / totalWeeks) * 100 : 0;
  const paceRatio = expectedPct > 0 ? overallCompletion / expectedPct : 1;
  const pace: PaceIndicator = paceRatio >= 1.1 ? 'ahead' : paceRatio >= 0.85 ? 'on_track' : 'behind';

  // Projected completion
  const weeksElapsed = Math.max(1, currentWeek - 1);
  const ratePerWeek = overallCompletion / weeksElapsed;
  const projectedCompletion = Math.min(100, ratePerWeek * totalWeeks);

  return { overallCompletion: Math.round(overallCompletion), pace, projectedCompletion };
}
