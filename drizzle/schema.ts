import { sqliteTable, text, integer, real, unique, index } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

// User table (lowercase for Auth.js compatibility)
export const users = sqliteTable('user', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified', { mode: 'timestamp' }),
  image: text('image'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Account table (lowercase for Auth.js compatibility)
export const accounts = sqliteTable('account', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('providerAccountId').notNull(),
  refreshToken: text('refresh_token'),
  accessToken: text('access_token'),
  expiresAt: integer('expires_at'),
  tokenType: text('token_type'),
  scope: text('scope'),
  idToken: text('id_token'),
  sessionState: text('session_state'),
}, (table) => ({
  providerProviderAccountIdUnique: unique().on(table.provider, table.providerAccountId),
  userIdIdx: index('account_userId_idx').on(table.userId),
}));

// Session table (lowercase for Auth.js compatibility)
export const sessions = sqliteTable('session', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionToken: text('sessionToken').notNull().unique(),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: integer('expires', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  userIdIdx: index('session_userId_idx').on(table.userId),
}));

// VerificationToken table (lowercase for Auth.js compatibility)
export const verificationTokens = sqliteTable('verificationToken', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull().unique(),
  expires: integer('expires', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  identifierTokenUnique: unique().on(table.identifier, table.token),
}));

// UserPreferences table
export const userPreferences = sqliteTable('UserPreferences', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  theme: text('theme').notNull().default('light'),
  timeFormat: text('timeFormat').notNull().default('12h'),
  dateFormat: text('dateFormat').notNull().default('DD/MM/YYYY'),
  weekdayPassThreshold: integer('weekdayPassThreshold').notNull().default(70),
  weekendPassThreshold: integer('weekendPassThreshold').notNull().default(70),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  userIdIdx: index('UserPreferences_userId_idx').on(table.userId),
}));

// Pillars table
export const pillars = sqliteTable('Pillar', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull(),
  name: text('name').notNull(),
  emoji: text('emoji').notNull().default('📌'),
  color: text('color').notNull().default('#3B82F6'),
  weight: real('weight').notNull().default(0),
  description: text('description'),
  isArchived: integer('isArchived', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sortOrder').notNull().default(0),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  userIdIdx: index('Pillar_userId_idx').on(table.userId),
}));

// Tasks table
export const tasks = sqliteTable('Task', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pillarId: integer('pillarId').references(() => pillars.id, { onDelete: 'set null' }),
  userId: text('userId').notNull(),
  name: text('name').notNull(),
  completionType: text('completionType').notNull().default('checkbox'), // checkbox|count|duration|numeric|percentage
  target: real('target'),
  unit: text('unit'),
  flexibilityRule: text('flexibilityRule').notNull().default('must_today'), // must_today|window|limit_avoid|carryover
  windowStart: integer('windowStart'),
  windowEnd: integer('windowEnd'),
  limitValue: real('limitValue'),
  importance: text('importance').notNull().default('medium'), // high|medium|low
  frequency: text('frequency').notNull().default('daily'), // daily|weekly|custom
  customDays: text('customDays'), // JSON array of day numbers [0-6] (0=Sunday)
  isWeekendTask: integer('isWeekendTask', { mode: 'boolean' }).notNull().default(false),
  basePoints: real('basePoints').notNull().default(10),
  outcomeId: integer('outcomeId').references(() => outcomes.id, { onDelete: 'set null' }),
  periodId: integer('periodId').references(() => twelveWeekYears.id, { onDelete: 'set null' }),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  userIdIdx: index('Task_userId_idx').on(table.userId),
  pillarIdIdx: index('Task_pillarId_idx').on(table.pillarId),
  outcomeIdIdx: index('Task_outcomeId_idx').on(table.outcomeId),
  periodIdIdx: index('Task_periodId_idx').on(table.periodId),
}));

// TaskCompletions table
export const taskCompletions = sqliteTable('TaskCompletion', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: integer('taskId').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  value: real('value'),
  pointsEarned: real('pointsEarned').notNull().default(0),
  completedAt: integer('completedAt', { mode: 'timestamp' }),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  userIdIdx: index('TaskCompletion_userId_idx').on(table.userId),
  taskIdIdx: index('TaskCompletion_taskId_idx').on(table.taskId),
  dateIdx: index('TaskCompletion_date_idx').on(table.date),
  taskDateUnique: unique().on(table.taskId, table.date),
}));

// DailyScores table
export const dailyScores = sqliteTable('DailyScore', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  actionScore: real('actionScore').notNull().default(0),
  pillarScores: text('pillarScores'), // JSON: { pillarId: score }
  xpEarned: real('xpEarned').notNull().default(0),
  streakBonus: real('streakBonus').notNull().default(0),
  isPassing: integer('isPassing', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  userIdIdx: index('DailyScore_userId_idx').on(table.userId),
  dateIdx: index('DailyScore_date_idx').on(table.date),
  userDateUnique: unique().on(table.userId, table.date),
}));

// UserStats table
export const userStats = sqliteTable('UserStats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull().unique(),
  totalXp: real('totalXp').notNull().default(0),
  level: integer('level').notNull().default(1),
  levelTitle: text('levelTitle').notNull().default('Beginner'),
  currentStreak: integer('currentStreak').notNull().default(0),
  bestStreak: integer('bestStreak').notNull().default(0),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  userIdIdx: index('UserStats_userId_idx').on(table.userId),
}));


// ActivityLog table
export const activityLog = sqliteTable('ActivityLog', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  taskId: integer('taskId').references(() => tasks.id, { onDelete: 'set null' }),
  pillarId: integer('pillarId').references(() => pillars.id, { onDelete: 'set null' }),
  action: text('action').notNull(), // complete | reverse | adjust | add | subtract
  previousValue: real('previousValue'),
  newValue: real('newValue'),
  delta: real('delta'),
  pointsBefore: real('pointsBefore'),
  pointsAfter: real('pointsAfter'),
  pointsDelta: real('pointsDelta'),
  source: text('source').notNull().default('manual'), // manual | timer | auto
  reversalOf: integer('reversalOf'),
  note: text('note'),
}, (table) => ({
  userIdIdx: index('ActivityLog_userId_idx').on(table.userId),
  taskIdIdx: index('ActivityLog_taskId_idx').on(table.taskId),
  timestampIdx: index('ActivityLog_timestamp_idx').on(table.timestamp),
}));

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  preferences: one(userPreferences),
  accounts: many(accounts),
  sessions: many(sessions),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id],
  }),
}));

export const pillarsRelations = relations(pillars, ({ many }) => ({
  tasks: many(tasks),
  outcomes: many(outcomes),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  pillar: one(pillars, {
    fields: [tasks.pillarId],
    references: [pillars.id],
  }),
  outcome: one(outcomes, {
    fields: [tasks.outcomeId],
    references: [outcomes.id],
  }),
  period: one(twelveWeekYears, {
    fields: [tasks.periodId],
    references: [twelveWeekYears.id],
  }),
  completions: many(taskCompletions),
}));

export const taskCompletionsRelations = relations(taskCompletions, ({ one }) => ({
  task: one(tasks, {
    fields: [taskCompletions.taskId],
    references: [tasks.id],
  }),
}));

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  task: one(tasks, {
    fields: [activityLog.taskId],
    references: [tasks.id],
  }),
  pillar: one(pillars, {
    fields: [activityLog.pillarId],
    references: [pillars.id],
  }),
}));

// Outcomes table
export const outcomes = sqliteTable('Outcome', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull(),
  pillarId: integer('pillarId').references(() => pillars.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  startValue: real('startValue').notNull(),
  targetValue: real('targetValue').notNull(),
  currentValue: real('currentValue').notNull(),
  unit: text('unit').notNull(),
  direction: text('direction').notNull(), // 'decrease' | 'increase'
  logFrequency: text('logFrequency').notNull().default('weekly'), // 'daily' | 'weekly' | 'custom'
  targetDate: text('targetDate'), // optional YYYY-MM-DD
  isArchived: integer('isArchived', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  userIdIdx: index('Outcome_userId_idx').on(table.userId),
  pillarIdIdx: index('Outcome_pillarId_idx').on(table.pillarId),
}));

// OutcomeLog table
export const outcomeLogs = sqliteTable('OutcomeLog', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  outcomeId: integer('outcomeId').notNull().references(() => outcomes.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull(),
  value: real('value').notNull(),
  loggedAt: integer('loggedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  source: text('source').notNull().default('manual'), // 'manual' | 'device_sync'
  note: text('note'),
}, (table) => ({
  outcomeIdIdx: index('OutcomeLog_outcomeId_idx').on(table.outcomeId),
  userIdIdx: index('OutcomeLog_userId_idx').on(table.userId),
}));

export const outcomesRelations = relations(outcomes, ({ one, many }) => ({
  pillar: one(pillars, { fields: [outcomes.pillarId], references: [pillars.id] }),
  logs: many(outcomeLogs),
  linkedTasks: many(tasks),
}));

export const outcomeLogsRelations = relations(outcomeLogs, ({ one }) => ({
  outcome: one(outcomes, { fields: [outcomeLogs.outcomeId], references: [outcomes.id] }),
}));

// TwelveWeekYear table
export const twelveWeekYears = sqliteTable('TwelveWeekYear', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull(),
  name: text('name').notNull(),
  startDate: text('startDate').notNull(),
  endDate: text('endDate').notNull(),
  vision: text('vision'),
  theme: text('theme'),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  userIdIdx: index('TwelveWeekYear_userId_idx').on(table.userId),
}));

// TwelveWeekGoal table
export const twelveWeekGoals = sqliteTable('TwelveWeekGoal', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  periodId: integer('periodId').notNull().references(() => twelveWeekYears.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull(),
  name: text('name').notNull(),
  targetValue: real('targetValue').notNull(),
  currentValue: real('currentValue').notNull().default(0),
  unit: text('unit').notNull(),
  linkedOutcomeId: integer('linkedOutcomeId').references(() => outcomes.id, { onDelete: 'set null' }),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  periodIdIdx: index('TwelveWeekGoal_periodId_idx').on(table.periodId),
  userIdIdx: index('TwelveWeekGoal_userId_idx').on(table.userId),
}));

// WeeklyTarget table
export const weeklyTargets = sqliteTable('WeeklyTarget', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  goalId: integer('goalId').notNull().references(() => twelveWeekGoals.id, { onDelete: 'cascade' }),
  periodId: integer('periodId').notNull().references(() => twelveWeekYears.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull(),
  weekNumber: integer('weekNumber').notNull(),
  targetValue: real('targetValue').notNull(),
  actualValue: real('actualValue').notNull().default(0),
  isOverridden: integer('isOverridden', { mode: 'boolean' }).notNull().default(false),
  score: text('score'),
  reviewedAt: integer('reviewedAt', { mode: 'timestamp' }),
}, (table) => ({
  goalIdIdx: index('WeeklyTarget_goalId_idx').on(table.goalId),
  periodIdIdx: index('WeeklyTarget_periodId_idx').on(table.periodId),
  userIdIdx: index('WeeklyTarget_userId_idx').on(table.userId),
  goalWeekUnique: unique().on(table.goalId, table.weekNumber),
}));

// TwelveWeekTactic table
export const twelveWeekTactics = sqliteTable('TwelveWeekTactic', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  goalId: integer('goalId').notNull().references(() => twelveWeekGoals.id, { onDelete: 'cascade' }),
  periodId: integer('periodId').notNull().references(() => twelveWeekYears.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  isCompleted: integer('isCompleted', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sortOrder').notNull().default(0),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  goalIdIdx: index('TwelveWeekTactic_goalId_idx').on(table.goalId),
  periodIdIdx: index('TwelveWeekTactic_periodId_idx').on(table.periodId),
  userIdIdx: index('TwelveWeekTactic_userId_idx').on(table.userId),
}));

// WeeklyReview table
export const weeklyReviews = sqliteTable('WeeklyReview', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  periodId: integer('periodId').notNull().references(() => twelveWeekYears.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull(),
  weekNumber: integer('weekNumber').notNull(),
  notes: text('notes'),
  wins: text('wins'),
  blockers: text('blockers'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  periodIdIdx: index('WeeklyReview_periodId_idx').on(table.periodId),
  userIdIdx: index('WeeklyReview_userId_idx').on(table.userId),
  periodWeekUnique: unique().on(table.periodId, table.weekNumber),
}));

// 12 Week Year relations
export const twelveWeekYearsRelations = relations(twelveWeekYears, ({ many }) => ({
  goals: many(twelveWeekGoals),
  weeklyTargets: many(weeklyTargets),
  tactics: many(twelveWeekTactics),
  weeklyReviews: many(weeklyReviews),
  linkedTasks: many(tasks),
}));

export const twelveWeekGoalsRelations = relations(twelveWeekGoals, ({ one, many }) => ({
  period: one(twelveWeekYears, { fields: [twelveWeekGoals.periodId], references: [twelveWeekYears.id] }),
  linkedOutcome: one(outcomes, { fields: [twelveWeekGoals.linkedOutcomeId], references: [outcomes.id] }),
  weeklyTargets: many(weeklyTargets),
  tactics: many(twelveWeekTactics),
}));

export const twelveWeekTacticsRelations = relations(twelveWeekTactics, ({ one }) => ({
  goal: one(twelveWeekGoals, { fields: [twelveWeekTactics.goalId], references: [twelveWeekGoals.id] }),
  period: one(twelveWeekYears, { fields: [twelveWeekTactics.periodId], references: [twelveWeekYears.id] }),
}));

export const weeklyReviewsRelations = relations(weeklyReviews, ({ one }) => ({
  period: one(twelveWeekYears, { fields: [weeklyReviews.periodId], references: [twelveWeekYears.id] }),
}));

export const weeklyTargetsRelations = relations(weeklyTargets, ({ one }) => ({
  goal: one(twelveWeekGoals, { fields: [weeklyTargets.goalId], references: [twelveWeekGoals.id] }),
  period: one(twelveWeekYears, { fields: [weeklyTargets.periodId], references: [twelveWeekYears.id] }),
}));

// GeneratedReports table
export const generatedReports = sqliteTable('GeneratedReport', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'weekly' | 'monthly'
  periodStart: text('periodStart').notNull(), // YYYY-MM-DD
  periodEnd: text('periodEnd').notNull(), // YYYY-MM-DD
  data: text('data').notNull(), // JSON string of the full report payload
  generatedAt: integer('generatedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  userIdIdx: index('GeneratedReport_userId_idx').on(table.userId),
  userTypePeriodUnique: unique().on(table.userId, table.type, table.periodStart),
}));

