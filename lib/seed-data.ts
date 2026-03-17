import { db } from '@/lib/db';
import { pillars, taskSchedules, tasks, cycles, goals, activityLog } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';
import { isScheduleForExactDate } from '@/lib/task-schedule';
import { calculateTaskScore } from '@/lib/scoring';
import { saveDailyScore } from '@/lib/save-daily-score';
import type { PillarSeed } from '@/lib/types';

// ── Seed definitions ──

const DEFAULT_PILLARS: PillarSeed[] = [
  {
    name: 'Health & Fitness',
    emoji: '💪',
    color: '#EF4444',
    weight: 25,
    description: 'Physical health, exercise, nutrition',

    tasks: [
      { name: 'Gym session', completionType: 'checkbox', frequency: 'custom', customDays: JSON.stringify([1, 2, 4, 5]), basePoints: 10 },
      { name: 'C25K run', completionType: 'checkbox', frequency: 'custom', customDays: JSON.stringify([1, 3, 5]), basePoints: 10 },
      { name: 'Hit protein target', completionType: 'numeric', target: 208, unit: 'g', frequency: 'daily', basePoints: 10 },
      { name: 'Stay in calories', completionType: 'numeric', target: 2040, unit: 'cal', frequency: 'daily', basePoints: 10 },
      { name: 'Take supplements', completionType: 'checkbox', frequency: 'daily', basePoints: 10 },
      { name: 'Water intake', completionType: 'count', target: 8, unit: 'glasses', frequency: 'daily', basePoints: 10 },
      { name: 'Social media limit', completionType: 'checkbox', frequency: 'daily', flexibilityRule: 'limit_avoid', basePoints: 10 },
    ],
  },
  {
    name: 'Career',
    emoji: '💼',
    color: '#3B82F6',
    weight: 25,
    description: 'Job search, skills, professional development',
    tasks: [
      { name: 'LeetCode problem', completionType: 'count', target: 1, unit: 'problems', frequency: 'daily', basePoints: 10 },
      { name: 'DSA concept', completionType: 'checkbox', frequency: 'daily', basePoints: 10 },
      { name: 'Deep-dive topic', completionType: 'duration', target: 15, unit: 'min', frequency: 'daily', basePoints: 10 },
      { name: 'Interview questions', completionType: 'count', target: 2, unit: 'questions', frequency: 'daily', basePoints: 10 },
      { name: 'Job application', completionType: 'count', target: 1, unit: 'applications', frequency: 'daily', basePoints: 10 },
    ],
  },
  {
    name: 'Side Hustle',
    emoji: '🚀',
    color: '#8B5CF6',
    weight: 15,
    description: 'Product development, content creation',
    tasks: [
      { name: 'Product work', completionType: 'duration', target: 60, unit: 'min', frequency: 'daily', basePoints: 10 },
      { name: 'YouTube content', completionType: 'checkbox', frequency: 'custom', customDays: JSON.stringify([6]), basePoints: 10 },
    ],
  },
  {
    name: 'Home',
    emoji: '🏠',
    color: '#F59E0B',
    weight: 10,
    description: 'Household chores and maintenance',
    tasks: [
      { name: 'Kitchen clean', completionType: 'checkbox', frequency: 'daily', basePoints: 10 },
      { name: 'Living area tidy', completionType: 'checkbox', frequency: 'daily', basePoints: 10 },
      { name: 'Vacuum/mop', completionType: 'checkbox', frequency: 'custom', customDays: JSON.stringify([6]), basePoints: 10 },
    ],
  },
  {
    name: 'Growth',
    emoji: '📖',
    color: '#10B981',
    weight: 15,
    description: 'Personal development, reading, learning',
    tasks: [
      { name: 'Bible writing', completionType: 'checkbox', frequency: 'daily', basePoints: 10 },
      { name: 'Reading', completionType: 'duration', target: 20, unit: 'min', frequency: 'daily', basePoints: 10 },
      { name: 'Morning routine', completionType: 'checkbox', frequency: 'daily', basePoints: 10 },
    ],
  },
  {
    name: 'Family & Faith',
    emoji: '👨‍👩‍👧',
    color: '#EC4899',
    weight: 10,
    description: 'Family time, church, community',
    tasks: [
      { name: 'Family time', completionType: 'checkbox', frequency: 'daily', basePoints: 10 },
      { name: 'Church duties', completionType: 'checkbox', frequency: 'custom', customDays: JSON.stringify([0]), basePoints: 10 },
    ],
  },
];

interface GoalSeed {
  name: string;
  pillarIndex: number; // index into DEFAULT_PILLARS
  goalType: 'habitual' | 'target' | 'outcome';
  completionType: string;
  unit: string;
  direction: 'up' | 'down';
  startValue: number;
  targetValue: number;
  currentValue: number;
  dailyTarget?: number;
  scheduleDays?: number[];
  logFrequency: string;
}

const DEFAULT_GOALS: GoalSeed[] = [
  {
    name: 'Lose 10kg',
    pillarIndex: 0, // Health
    goalType: 'outcome',
    completionType: 'numeric',
    unit: 'kg',
    direction: 'down',
    startValue: 95,
    targetValue: 85,
    currentValue: 91.2,
    logFrequency: 'weekly',
  },
  {
    name: 'Run 5K without stopping',
    pillarIndex: 0, // Health
    goalType: 'target',
    completionType: 'numeric',
    unit: 'km',
    direction: 'up',
    startValue: 0,
    targetValue: 5,
    currentValue: 3.2,
    logFrequency: 'weekly',
  },
  {
    name: 'Read 12 books this year',
    pillarIndex: 4, // Growth
    goalType: 'target',
    completionType: 'count',
    unit: 'books',
    direction: 'up',
    startValue: 0,
    targetValue: 12,
    currentValue: 4,
    logFrequency: 'weekly',
  },
  {
    name: 'Meditate daily',
    pillarIndex: 4, // Growth
    goalType: 'habitual',
    completionType: 'checkbox',
    unit: 'sessions',
    direction: 'up',
    startValue: 0,
    targetValue: 90,
    currentValue: 38,
    dailyTarget: 1,
    scheduleDays: [1, 2, 3, 4, 5, 6, 0],
    logFrequency: 'daily',
  },
  {
    name: 'Ship MVP product',
    pillarIndex: 2, // Side Hustle
    goalType: 'target',
    completionType: 'numeric',
    unit: '% complete',
    direction: 'up',
    startValue: 0,
    targetValue: 100,
    currentValue: 65,
    logFrequency: 'weekly',
  },
  {
    name: 'Apply to 50 jobs',
    pillarIndex: 1, // Career
    goalType: 'target',
    completionType: 'count',
    unit: 'applications',
    direction: 'up',
    startValue: 0,
    targetValue: 50,
    currentValue: 22,
    logFrequency: 'daily',
  },
];

// ── Helpers ──

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

function generateDummyCompletion(
  taskData: PillarSeed['tasks'][number],
  rand: () => number,
): { completed: boolean; value: number | null } | null {
  if (rand() > 0.7) return null; // ~70% completion rate

  if (taskData.completionType === 'checkbox') {
    return { completed: true, value: 1 };
  }
  if (taskData.completionType === 'count' && taskData.target) {
    const hitTarget = rand() > 0.2;
    const value = hitTarget ? taskData.target : Math.max(1, Math.floor(taskData.target * (0.3 + rand() * 0.6)));
    return { completed: value >= taskData.target, value };
  }
  if (taskData.completionType === 'duration' && taskData.target) {
    const hitTarget = rand() > 0.25;
    const value = hitTarget
      ? Math.round(taskData.target * (0.9 + rand() * 0.4))
      : Math.round(taskData.target * (0.3 + rand() * 0.5));
    return { completed: value >= taskData.target, value };
  }
  if (taskData.completionType === 'numeric' && taskData.target) {
    const hitTarget = rand() > 0.3;
    const value = hitTarget
      ? Math.round(taskData.target * (0.95 + rand() * 0.1))
      : Math.round(taskData.target * (0.5 + rand() * 0.4));
    return { completed: value >= taskData.target, value };
  }
  return { completed: true, value: 1 };
}

// ── Main seed function ──

export async function seedDefaultData(userId: string, skipCheck = false) {
  if (!skipCheck) {
    const existing = await db
      .select({ count: sql<number>`count(*)` })
      .from(pillars)
      .where(eq(pillars.userId, userId));
    if (existing[0].count > 0) return;
  }

  const now = new Date();
  const todayStr = dateStr(now);
  const rand = seededRandom(42);

  // ── 1. Create Cycles ──

  const cycleStartDate = addDays(now, -42); // started 6 weeks ago
  const cycleEndDate = addDays(now, 42);    // ends 6 weeks from now

  const [activeCycle] = await db.insert(cycles).values({
    userId,
    name: 'Q1 Focus Sprint',
    startDate: dateStr(cycleStartDate),
    endDate: dateStr(cycleEndDate),
    vision: 'Build momentum across health, career, and personal growth. Ship the MVP and land a great role.',
    theme: 'Discipline & Consistency',
  }).returning();

  const pastCycleStart = addDays(now, -126); // ~18 weeks ago
  const pastCycleEnd = addDays(now, -43);
  await db.insert(cycles).values({
    userId,
    name: 'Foundation Period',
    startDate: dateStr(pastCycleStart),
    endDate: dateStr(pastCycleEnd),
    vision: 'Establish habits and routines that support long-term goals.',
    theme: 'Building the Base',
  });

  // ── 2. Create Pillars ──

  const pillarIds: number[] = [];

  for (const pillarData of DEFAULT_PILLARS) {
    const [pillar] = await db.insert(pillars).values({
      userId,
      name: pillarData.name,
      emoji: pillarData.emoji,
      color: pillarData.color,
      weight: pillarData.weight,
      description: pillarData.description,
    }).returning();
    pillarIds.push(pillar.id);
  }

  // ── 3. Create Goals (linked to pillars & active cycle) ──

  const goalIds: number[] = [];

  for (const goalData of DEFAULT_GOALS) {
    const pillarId = pillarIds[goalData.pillarIndex];
    const [goal] = await db.insert(goals).values({
      userId,
      pillarId,
      name: goalData.name,
      goalType: goalData.goalType,
      completionType: goalData.completionType,
      unit: goalData.unit,
      direction: goalData.direction,
      startValue: goalData.startValue,
      targetValue: goalData.targetValue,
      currentValue: goalData.currentValue,
      dailyTarget: goalData.dailyTarget ?? null,
      scheduleDays: goalData.scheduleDays ? JSON.stringify(goalData.scheduleDays) : null,
      logFrequency: goalData.logFrequency,
      startDate: dateStr(cycleStartDate),
      targetDate: dateStr(cycleEndDate),
      periodId: activeCycle.id,
      autoCreateTasks: false,
    }).returning();
    goalIds.push(goal.id);
  }

  // ── 4. Create Task Schedules & Task Instances ──

  // Date range: 14 days back through 7 days ahead
  const allDates: string[] = [];
  for (let i = -14; i < 8; i++) {
    allDates.push(dateStr(addDays(now, i)));
  }

  const pastDatesWithScores = new Set<string>();
  const activityLogEntries: (typeof activityLog.$inferInsert)[] = [];

  // Map some tasks to goals for linkage
  const taskGoalLinks: Record<string, number> = {
    'Job application': goalIds[5],   // Apply to 50 jobs
    'Product work': goalIds[4],      // Ship MVP
    'Reading': goalIds[2],           // Read 12 books
    'C25K run': goalIds[1],          // Run 5K
  };

  for (let pi = 0; pi < DEFAULT_PILLARS.length; pi++) {
    const pillarData = DEFAULT_PILLARS[pi];
    const pillarId = pillarIds[pi];

    for (const taskData of pillarData.tasks) {
      const linkedGoalId = taskGoalLinks[taskData.name] ?? null;

      const [schedule] = await db.insert(taskSchedules).values({
        pillarId,
        userId,
        name: taskData.name,
        completionType: taskData.completionType,
        target: taskData.target ?? null,
        unit: taskData.unit ?? null,
        frequency: taskData.frequency,
        customDays: taskData.customDays ?? null,
        flexibilityRule: taskData.flexibilityRule ?? 'must_today',
        basePoints: taskData.basePoints,
        goalId: linkedGoalId,
        periodId: activeCycle.id,
      }).returning();

      for (const ds of allDates) {
        if (!isScheduleForExactDate(schedule, ds)) continue;

        const isPast = ds < todayStr;
        const dummy = isPast ? generateDummyCompletion(taskData, rand) : null;
        const completed = dummy?.completed ?? false;
        const value = dummy?.value ?? null;
        const pointsEarned = completed ? calculateTaskScore(
          { id: 0, pillarId, completionType: taskData.completionType, target: taskData.target ?? null, basePoints: taskData.basePoints, flexibilityRule: taskData.flexibilityRule, limitValue: null },
          { taskId: 0, completed, value }
        ) : 0;

        try {
          const [taskRow] = await db.insert(tasks).values({
            scheduleId: schedule.id,
            userId,
            pillarId,
            name: taskData.name,
            completionType: taskData.completionType,
            target: taskData.target ?? null,
            unit: taskData.unit ?? null,
            flexibilityRule: taskData.flexibilityRule ?? 'must_today',
            basePoints: taskData.basePoints,
            goalId: linkedGoalId,
            periodId: activeCycle.id,
            date: ds,
            completed,
            value,
            pointsEarned,
            isHighlighted: false,
            completedAt: completed ? new Date(ds + 'T12:00:00') : null,
          }).returning();

          if (isPast) pastDatesWithScores.add(ds);

          // Build activity log entry for completed tasks
          if (completed && taskRow) {
            activityLogEntries.push({
              userId,
              timestamp: new Date(ds + 'T12:00:00'),
              taskId: taskRow.id,
              pillarId,
              action: 'complete',
              previousValue: 0,
              newValue: value ?? 1,
              delta: value ?? 1,
              pointsBefore: 0,
              pointsAfter: pointsEarned,
              pointsDelta: pointsEarned,
              source: taskData.completionType === 'duration' ? 'timer' : 'manual',
            });
          }
        } catch {
          // Ignore duplicate key errors
        }
      }
    }
  }

  // ── 5. Insert Activity Log entries ──

  for (const entry of activityLogEntries) {
    try {
      await db.insert(activityLog).values(entry);
    } catch {
      // Ignore errors
    }
  }

  // ── 6. Calculate and persist Daily Scores for all past dates + today ──

  const sortedPastDates = [...pastDatesWithScores].sort();
  for (const ds of sortedPastDates) {
    await saveDailyScore(userId, ds);
  }
  await saveDailyScore(userId, todayStr);
}
