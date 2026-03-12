export interface AnalyticsGoal {
  id: number;
  name: string;
  targetValue: number;
  currentValue: number;
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
    return {
      overallCompletion: 0,
      pace: 'on_track',
      projectedCompletion: 0,
    };
  }

  // Overall completion: sum of currentValues / sum of targetValues
  const totalCurrent = goals.reduce((s, g) => s + g.currentValue, 0);
  const totalTarget = goals.reduce((s, g) => s + g.targetValue, 0);
  const overallCompletion = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;

  // Expected completion at this week
  const expectedCompletion = totalTarget > 0
    ? ((Math.max(0, currentWeek - 1) / totalWeeks) * totalTarget)
    : 0;
  const paceRatio = expectedCompletion > 0 ? totalCurrent / expectedCompletion : 1;
  const pace: PaceIndicator = paceRatio >= 1.1 ? 'ahead' : paceRatio >= 0.85 ? 'on_track' : 'behind';

  // Projected completion based on current pace
  const weeksElapsed = Math.max(1, currentWeek - 1);
  const ratePerWeek = totalCurrent / weeksElapsed;
  const projectedCompletion = totalTarget > 0
    ? Math.min(100, (ratePerWeek * totalWeeks / totalTarget) * 100)
    : 0;

  return {
    overallCompletion,
    pace,
    projectedCompletion,
  };
}
