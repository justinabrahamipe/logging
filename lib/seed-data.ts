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
    defaultBasePoints: 10,
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
    defaultBasePoints: 10,
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
    defaultBasePoints: 15,
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
    defaultBasePoints: 5,
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
    defaultBasePoints: 10,
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
    defaultBasePoints: 10,
    description: 'Family time, church, community',
    tasks: [
      { name: 'Family time', completionType: 'checkbox', frequency: 'daily', basePoints: 10 },
      { name: 'Church duties', completionType: 'checkbox', frequency: 'custom', customDays: JSON.stringify([0]), basePoints: 10 },
    ],
  },
];

interface GoalSeed {
  name: string;
  pillarIndex: number;
  goalType: 'habitual' | 'target' | 'outcome';
  completionType: string;
  unit: string;
  startValue: number;
  targetValue: number;
  currentValue: number;
  dailyTarget?: number;
  scheduleDays?: number[];
}

const DEFAULT_GOALS: GoalSeed[] = [
  { name: 'Lose 10kg', pillarIndex: 0, goalType: 'outcome', completionType: 'numeric', unit: 'kg', startValue: 95, targetValue: 85, currentValue: 91.2 },
  { name: 'Run 5K without stopping', pillarIndex: 0, goalType: 'target', completionType: 'numeric', unit: 'km', startValue: 0, targetValue: 5, currentValue: 3.2 },
  { name: 'Read 12 books this year', pillarIndex: 4, goalType: 'target', completionType: 'count', unit: 'books', startValue: 0, targetValue: 12, currentValue: 4 },
  { name: 'Meditate daily', pillarIndex: 4, goalType: 'habitual', completionType: 'checkbox', unit: 'sessions', startValue: 0, targetValue: 90, currentValue: 38, dailyTarget: 1, scheduleDays: [1, 2, 3, 4, 5, 6, 0] },
  { name: 'Ship MVP product', pillarIndex: 2, goalType: 'target', completionType: 'numeric', unit: '% complete', startValue: 0, targetValue: 100, currentValue: 65 },
  { name: 'Apply to 50 jobs', pillarIndex: 1, goalType: 'target', completionType: 'count', unit: 'applications', startValue: 0, targetValue: 50, currentValue: 22 },
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
  if (rand() > 0.7) return null;

  if (taskData.completionType === 'checkbox') return { completed: true, value: 1 };
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

  const cycleStartDate = addDays(now, -42);
  const cycleEndDate = addDays(now, 42);

  const [activeCycle] = await db.insert(cycles).values({
    userId,
    name: 'Q1 Focus Sprint',
    startDate: dateStr(cycleStartDate),
    endDate: dateStr(cycleEndDate),
    vision: 'Build momentum across health, career, and personal growth. Ship the MVP and land a great role.',
    theme: 'Discipline & Consistency',
  }).returning();

  await db.insert(cycles).values({
    userId,
    name: 'Foundation Period',
    startDate: dateStr(addDays(now, -126)),
    endDate: dateStr(addDays(now, -43)),
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
      defaultBasePoints: pillarData.defaultBasePoints,
      description: pillarData.description,
    }).returning();
    pillarIds.push(pillar.id);
  }

  // ── 3. Create Goals ──

  const goalIds: number[] = [];
  for (const goalData of DEFAULT_GOALS) {
    const [goal] = await db.insert(goals).values({
      userId,
      pillarId: pillarIds[goalData.pillarIndex],
      name: goalData.name,
      goalType: goalData.goalType,
      completionType: goalData.completionType,
      unit: goalData.unit,
      startValue: goalData.startValue,
      targetValue: goalData.targetValue,
      currentValue: goalData.currentValue,
      dailyTarget: goalData.dailyTarget ?? null,
      scheduleDays: goalData.scheduleDays ? JSON.stringify(goalData.scheduleDays) : null,
      startDate: dateStr(cycleStartDate),
      targetDate: dateStr(cycleEndDate),
      periodId: activeCycle.id,
      autoCreateTasks: false,
    }).returning();
    goalIds.push(goal.id);
  }

  // ── 4. Create Task Schedules & Task Instances ──
  // Only 7 days back + 7 days ahead to keep it fast

  const allDates: string[] = [];
  for (let i = -7; i < 8; i++) {
    allDates.push(dateStr(addDays(now, i)));
  }

  const taskGoalLinks: Record<string, number> = {
    'Job application': goalIds[5],
    'Product work': goalIds[4],
    'Reading': goalIds[2],
    'C25K run': goalIds[1],
  };

  // Collect all task inserts to batch them
  const taskInserts: (typeof tasks.$inferInsert)[] = [];

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

        taskInserts.push({
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
        });
      }
    }
  }

  // Batch insert all tasks (chunks of 50 to avoid query size limits)
  for (let i = 0; i < taskInserts.length; i += 50) {
    const chunk = taskInserts.slice(i, i + 50);
    try {
      await db.insert(tasks).values(chunk);
    } catch {
      // Fall back to individual inserts if batch fails
      for (const val of chunk) {
        try { await db.insert(tasks).values(val); } catch { /* ignore duplicates */ }
      }
    }
  }

  // ── 5. Calculate daily scores for past days + today ──
  // Only score the last 7 days to stay within timeout
  const pastDates = allDates.filter(d => d <= todayStr);
  for (const ds of pastDates) {
    await saveDailyScore(userId, ds);
  }
}
