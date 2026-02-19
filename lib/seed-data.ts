import { db } from '@/lib/db';
import { pillars, tasks, userStats } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';

interface PillarSeed {
  name: string;
  emoji: string;
  color: string;
  weight: number;
  description: string;
  sortOrder: number;
  tasks: TaskSeed[];
}

interface TaskSeed {
  name: string;
  completionType: string;
  target?: number;
  unit?: string;
  importance: string;
  frequency: string;
  customDays?: string;
  isWeekendTask?: boolean;
  flexibilityRule?: string;
  basePoints: number;
}

const DEFAULT_PILLARS: PillarSeed[] = [
  {
    name: 'Health & Fitness',
    emoji: '💪',
    color: '#EF4444',
    weight: 25,
    description: 'Physical health, exercise, nutrition',
    sortOrder: 0,
    tasks: [
      { name: 'Gym session', completionType: 'checkbox', importance: 'high', frequency: 'custom', customDays: JSON.stringify([1, 2, 4, 5]), basePoints: 10 },
      { name: 'C25K run', completionType: 'checkbox', importance: 'high', frequency: 'custom', customDays: JSON.stringify([1, 3, 5]), basePoints: 10 },
      { name: 'Hit protein target', completionType: 'numeric', target: 208, unit: 'g', importance: 'high', frequency: 'daily', basePoints: 10 },
      { name: 'Stay in calories', completionType: 'numeric', target: 2040, unit: 'cal', importance: 'medium', frequency: 'daily', basePoints: 10 },
      { name: 'Take supplements', completionType: 'checkbox', importance: 'low', frequency: 'daily', basePoints: 10 },
      { name: 'Water intake', completionType: 'count', target: 8, unit: 'glasses', importance: 'medium', frequency: 'daily', basePoints: 10 },
      { name: 'Social media limit', completionType: 'checkbox', importance: 'medium', frequency: 'daily', flexibilityRule: 'limit_avoid', basePoints: 10 },
    ],
  },
  {
    name: 'Career',
    emoji: '💼',
    color: '#3B82F6',
    weight: 25,
    description: 'Job search, skills, professional development',
    sortOrder: 1,
    tasks: [
      { name: 'LeetCode problem', completionType: 'count', target: 1, unit: 'problems', importance: 'high', frequency: 'daily', basePoints: 10 },
      { name: 'DSA concept', completionType: 'checkbox', importance: 'medium', frequency: 'daily', basePoints: 10 },
      { name: 'Deep-dive topic', completionType: 'duration', target: 15, unit: 'min', importance: 'medium', frequency: 'daily', basePoints: 10 },
      { name: 'Interview questions', completionType: 'count', target: 2, unit: 'questions', importance: 'medium', frequency: 'daily', basePoints: 10 },
      { name: 'Job application', completionType: 'count', target: 1, unit: 'applications', importance: 'high', frequency: 'daily', basePoints: 10 },
    ],
  },
  {
    name: 'Side Hustle',
    emoji: '🚀',
    color: '#8B5CF6',
    weight: 15,
    description: 'Product development, content creation',
    sortOrder: 2,
    tasks: [
      { name: 'Product work', completionType: 'duration', target: 60, unit: 'min', importance: 'high', frequency: 'daily', basePoints: 10 },
      { name: 'YouTube content', completionType: 'checkbox', importance: 'medium', frequency: 'weekly', basePoints: 10 },
    ],
  },
  {
    name: 'Home',
    emoji: '🏠',
    color: '#F59E0B',
    weight: 10,
    description: 'Household chores and maintenance',
    sortOrder: 3,
    tasks: [
      { name: 'Kitchen clean', completionType: 'checkbox', importance: 'medium', frequency: 'daily', basePoints: 10 },
      { name: 'Living area tidy', completionType: 'checkbox', importance: 'low', frequency: 'daily', basePoints: 10 },
      { name: 'Vacuum/mop', completionType: 'checkbox', importance: 'low', frequency: 'weekly', basePoints: 10 },
    ],
  },
  {
    name: 'Growth',
    emoji: '📖',
    color: '#10B981',
    weight: 15,
    description: 'Personal development, reading, learning',
    sortOrder: 4,
    tasks: [
      { name: 'Bible writing', completionType: 'checkbox', importance: 'high', frequency: 'daily', basePoints: 10 },
      { name: 'Reading', completionType: 'duration', target: 20, unit: 'min', importance: 'medium', frequency: 'daily', basePoints: 10 },
      { name: 'Morning routine', completionType: 'checkbox', importance: 'medium', frequency: 'daily', basePoints: 10 },
    ],
  },
  {
    name: 'Family & Faith',
    emoji: '👨‍👩‍👧',
    color: '#EC4899',
    weight: 10,
    description: 'Family time, church, community',
    sortOrder: 5,
    tasks: [
      { name: 'Family time', completionType: 'checkbox', importance: 'high', frequency: 'daily', basePoints: 10 },
      { name: 'Church duties', completionType: 'checkbox', importance: 'medium', frequency: 'weekly', isWeekendTask: true, basePoints: 10 },
    ],
  },
];

export async function seedDefaultData(userId: string, skipCheck = false) {
  // Guard: check if user already has pillars to prevent duplicates
  if (!skipCheck) {
    const existing = await db
      .select({ count: sql<number>`count(*)` })
      .from(pillars)
      .where(eq(pillars.userId, userId));

    if (existing[0].count > 0) {
      return;
    }
  }

  for (const pillarData of DEFAULT_PILLARS) {
    const [pillar] = await db.insert(pillars).values({
      userId,
      name: pillarData.name,
      emoji: pillarData.emoji,
      color: pillarData.color,
      weight: pillarData.weight,
      description: pillarData.description,
      sortOrder: pillarData.sortOrder,
    }).returning();

    for (const taskData of pillarData.tasks) {
      await db.insert(tasks).values({
        pillarId: pillar.id,
        userId,
        name: taskData.name,
        completionType: taskData.completionType,
        target: taskData.target ?? null,
        unit: taskData.unit ?? null,
        importance: taskData.importance,
        frequency: taskData.frequency,
        customDays: taskData.customDays ?? null,
        isWeekendTask: taskData.isWeekendTask ?? false,
        flexibilityRule: taskData.flexibilityRule ?? 'must_today',
        basePoints: taskData.basePoints,
      });
    }
  }

  // Initialize user stats
  await db.insert(userStats).values({
    userId,
    totalXp: 0,
    level: 1,
    levelTitle: 'Beginner',
    currentStreak: 0,
    bestStreak: 0,
  }).onConflictDoNothing();
}
