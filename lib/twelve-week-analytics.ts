export interface AnalyticsGoal {
  id: number;
  name: string;
  targetValue: number;
  currentValue: number;
}

export interface AnalyticsTarget {
  goalId: number;
  weekNumber: number;
  targetValue: number;
  actualValue: number;
  score: string | null;
}

export type PaceIndicator = 'ahead' | 'on_track' | 'behind';

export interface CycleAnalytics {
  overallCompletion: number;
  pace: PaceIndicator;
  consistentWeeks: number;
  totalReviewedWeeks: number;
  goalTrends: { goalId: number; goalName: string; weeklyActuals: number[] }[];
  projectedCompletion: number;
}

export function computeCycleAnalytics(
  goals: AnalyticsGoal[],
  weeklyTargets: AnalyticsTarget[],
  currentWeek: number,
  totalWeeks: number
): CycleAnalytics {
  if (goals.length === 0) {
    return {
      overallCompletion: 0,
      pace: 'on_track',
      consistentWeeks: 0,
      totalReviewedWeeks: 0,
      goalTrends: [],
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

  // Per-goal weekly trends
  const goalTrends = goals.map((goal) => {
    const weeklyActuals = Array.from({ length: totalWeeks }, (_, i) => {
      const t = weeklyTargets.find((wt) => wt.goalId === goal.id && wt.weekNumber === i + 1);
      return t?.actualValue ?? 0;
    });
    return { goalId: goal.id, goalName: goal.name, weeklyActuals };
  });

  // Consistent weeks: weeks where all goals scored "good" or "exceeded"
  let consistentWeeks = 0;
  let totalReviewedWeeks = 0;
  for (let w = 1; w <= totalWeeks; w++) {
    const weekScores = weeklyTargets.filter((t) => t.weekNumber === w && t.score);
    if (weekScores.length === goals.length && weekScores.length > 0) {
      totalReviewedWeeks++;
      const allGood = weekScores.every((s) => s.score === 'good' || s.score === 'exceeded');
      if (allGood) consistentWeeks++;
    }
  }

  // Projected completion based on current pace
  const weeksElapsed = Math.max(1, currentWeek - 1);
  const ratePerWeek = totalCurrent / weeksElapsed;
  const projectedCompletion = totalTarget > 0
    ? Math.min(100, (ratePerWeek * totalWeeks / totalTarget) * 100)
    : 0;

  return {
    overallCompletion,
    pace,
    consistentWeeks,
    totalReviewedWeeks,
    goalTrends,
    projectedCompletion,
  };
}
