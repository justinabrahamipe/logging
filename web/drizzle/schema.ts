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
  apiKey: text('apiKey'), // deprecated: cleared on first use, replaced by apiKeyHash
  apiKeyHash: text('apiKeyHash'), // SHA-256 hash of the API key
  streakThreshold: integer('streakThreshold').notNull().default(95), // minimum action score % to count as a streak day
  habitualColor: text('habitualColor').notNull().default('#3B82F6'), // blue
  targetColor: text('targetColor').notNull().default('#F59E0B'), // amber
  outcomeColor: text('outcomeColor').notNull().default('#A855F7'), // purple
  isPremium: integer('isPremium', { mode: 'boolean' }).notNull().default(false),
  premiumActivatedAt: integer('premiumActivatedAt', { mode: 'timestamp' }),
  promoCode: text('promoCode'),
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
  defaultBasePoints: real('defaultBasePoints').notNull().default(10),
  description: text('description'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  userIdIdx: index('Pillar_userId_idx').on(table.userId),
}));

// Task Schedules table (recurring task definitions)
export const taskSchedules = sqliteTable('TaskSchedule', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pillarId: integer('pillarId').references(() => pillars.id, { onDelete: 'set null' }),
  userId: text('userId').notNull(),
  name: text('name').notNull(),
  completionType: text('completionType').notNull().default('checkbox'), // checkbox|count|duration|numeric
  target: real('target'),
  unit: text('unit'),
  flexibilityRule: text('flexibilityRule').notNull().default('must_today'), // must_today|at_least|limit_avoid
  limitValue: real('limitValue'),
  description: text('description'),
  frequency: text('frequency').notNull().default('daily'), // daily|weekly|custom|monthly|interval|adhoc
  customDays: text('customDays'), // JSON array: day-of-week [0-6] for custom, day-of-month [1-31] for monthly
  repeatInterval: integer('repeatInterval'), // repeat every N days/weeks/months depending on frequency
  basePoints: real('basePoints').notNull().default(10),
  goalId: integer('goalId').references(() => goals.id, { onDelete: 'set null' }),
  periodId: integer('periodId').references(() => cycles.id, { onDelete: 'set null' }),
  startDate: text('startDate'), // optional YYYY-MM-DD, schedule only active from this date
  endDate: text('endDate'), // optional YYYY-MM-DD, schedule stops generating tasks after this date
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  userIdIdx: index('TaskSchedule_userId_idx').on(table.userId),
  pillarIdIdx: index('TaskSchedule_pillarId_idx').on(table.pillarId),
  goalIdIdx: index('TaskSchedule_goalId_idx').on(table.goalId),
  periodIdIdx: index('TaskSchedule_periodId_idx').on(table.periodId),
}));

// Tasks table (concrete per-date instances with completion data)
export const tasks = sqliteTable('Task', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  scheduleId: integer('scheduleId').references(() => taskSchedules.id, { onDelete: 'set null' }),
  pillarId: integer('pillarId').references(() => pillars.id, { onDelete: 'set null' }),
  userId: text('userId').notNull(),
  name: text('name').notNull(),
  completionType: text('completionType').notNull().default('checkbox'), // checkbox|count|duration|numeric
  target: real('target'),
  unit: text('unit'),
  flexibilityRule: text('flexibilityRule').notNull().default('must_today'),
  limitValue: real('limitValue'),
  description: text('description'),

  basePoints: real('basePoints').notNull().default(10),
  goalId: integer('goalId').references(() => goals.id, { onDelete: 'set null' }),
  periodId: integer('periodId').references(() => cycles.id, { onDelete: 'set null' }),
  date: text('date').notNull(), // YYYY-MM-DD - the specific date this task is for
  originalDate: text('originalDate'), // YYYY-MM-DD - the date this task was originally generated for (tracks postponed tasks)
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  value: real('value'),
  pointsEarned: real('pointsEarned').notNull().default(0),
  isHighlighted: integer('isHighlighted', { mode: 'boolean' }).notNull().default(false),
  completedAt: integer('completedAt', { mode: 'timestamp' }),
  timerStartedAt: integer('timerStartedAt'), // epoch ms when timer was started (null = not running)
  skipped: integer('skipped', { mode: 'boolean' }).notNull().default(false), // true = user chose not to do this task today
  dismissed: integer('dismissed', { mode: 'boolean' }).notNull().default(false), // true = user explicitly removed this task instance (prevents auto-recreation)
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  userIdIdx: index('Task_userId_idx').on(table.userId),
  pillarIdIdx: index('Task_pillarId_idx').on(table.pillarId),
  goalIdIdx: index('Task_goalId_idx').on(table.goalId),
  periodIdIdx: index('Task_periodId_idx').on(table.periodId),
  dateIdx: index('Task_date_idx').on(table.date),
  userDateIdx: index('Task_userId_date_idx').on(table.userId, table.date),
  userGoalCompletedIdx: index('Task_userId_goalId_completed_idx').on(table.userId, table.goalId, table.completed),
  userScheduleIdx: index('Task_userId_scheduleId_idx').on(table.userId, table.scheduleId),
  goalCompletedValueIdx: index('Task_goalId_completed_value_idx').on(table.goalId, table.completed, table.value),
  scheduleDateUnique: unique().on(table.scheduleId, table.date),
}));

// DailyScores table
export const dailyScores = sqliteTable('DailyScore', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  actionScore: real('actionScore').notNull().default(0),
  momentumScore: real('momentumScore'), // goal-based momentum (0-200+, 100 = on pace)
  trajectoryScore: real('trajectoryScore'), // outcome goal trajectory (0-200+, 100 = on pace)
  pillarScores: text('pillarScores'), // JSON: { pillarId: score }
  pillarMomentum: text('pillarMomentum'), // JSON: { pillarId: momentum }
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  userIdIdx: index('DailyScore_userId_idx').on(table.userId),
  dateIdx: index('DailyScore_date_idx').on(table.date),
  userDateUnique: unique().on(table.userId, table.date),
}));


// ActivityLog table
export const activityLog = sqliteTable('ActivityLog', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  taskId: integer('taskId'),
  pillarId: integer('pillarId').references(() => pillars.id, { onDelete: 'set null' }),
  action: text('action').notNull(), // complete | reverse | adjust | add | subtract | outcome_log
  previousValue: real('previousValue'),
  newValue: real('newValue'),
  delta: real('delta'),
  pointsBefore: real('pointsBefore'),
  pointsAfter: real('pointsAfter'),
  pointsDelta: real('pointsDelta'),
  source: text('source').notNull().default('manual'), // manual | timer | auto
}, (table) => ({
  userIdIdx: index('ActivityLog_userId_idx').on(table.userId),
  taskIdIdx: index('ActivityLog_taskId_idx').on(table.taskId),
  timestampIdx: index('ActivityLog_timestamp_idx').on(table.timestamp),
  userTimestampIdx: index('ActivityLog_userId_timestamp_idx').on(table.userId, table.timestamp),
}));

// Contact messages table
export const contactMessages = sqliteTable('ContactMessage', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  topic: text('topic').notNull().default('General Feedback'),
  message: text('message').notNull(),
  status: text('status').notNull().default('todo'), // todo | in_progress | done
  read: integer('read', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

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
  taskSchedules: many(taskSchedules),
  tasks: many(tasks),
  goals: many(goals),
}));

export const taskSchedulesRelations = relations(taskSchedules, ({ one, many }) => ({
  pillar: one(pillars, {
    fields: [taskSchedules.pillarId],
    references: [pillars.id],
  }),
  outcome: one(goals, {
    fields: [taskSchedules.goalId],
    references: [goals.id],
  }),
  period: one(cycles, {
    fields: [taskSchedules.periodId],
    references: [cycles.id],
  }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  schedule: one(taskSchedules, {
    fields: [tasks.scheduleId],
    references: [taskSchedules.id],
  }),
  pillar: one(pillars, {
    fields: [tasks.pillarId],
    references: [pillars.id],
  }),
  outcome: one(goals, {
    fields: [tasks.goalId],
    references: [goals.id],
  }),
  period: one(cycles, {
    fields: [tasks.periodId],
    references: [cycles.id],
  }),
}));

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  pillar: one(pillars, {
    fields: [activityLog.pillarId],
    references: [pillars.id],
  }),
}));

// Goals table
export const goals = sqliteTable('Goal', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull(),
  pillarId: integer('pillarId').references(() => pillars.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  startValue: real('startValue').notNull(),
  targetValue: real('targetValue').notNull(),
  currentValue: real('currentValue').notNull(),
  unit: text('unit').notNull(),
  startDate: text('startDate'),
  targetDate: text('targetDate'),
  periodId: integer('periodId').references(() => cycles.id, { onDelete: 'set null' }),
  goalType: text('goalType').notNull().default('outcome'), // 'habitual' | 'target' | 'outcome' | 'project'
  completionType: text('completionType').notNull().default('checkbox'), // 'checkbox' | 'count' | 'numeric'
  dailyTarget: real('dailyTarget'), // per-session target for count/numeric habitual goals
  scheduleDays: text('scheduleDays'), // JSON weekday array e.g. [1,3,5]
  autoCreateTasks: integer('autoCreateTasks', { mode: 'boolean' }).notNull().default(false),
  flexibilityRule: text('flexibilityRule').notNull().default('must_today'), // must_today|at_least|limit_avoid
  limitValue: real('limitValue'),
  basePoints: real('basePoints').notNull().default(10),

  status: text('status').notNull().default('active'), // active | completed | abandoned
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  userIdIdx: index('Goal_userId_idx').on(table.userId),
  pillarIdIdx: index('Goal_pillarId_idx').on(table.pillarId),
  periodIdIdx: index('Goal_periodId_idx').on(table.periodId),
}));

export const goalsRelations = relations(goals, ({ one, many }) => ({
  pillar: one(pillars, { fields: [goals.pillarId], references: [pillars.id] }),
  period: one(cycles, { fields: [goals.periodId], references: [cycles.id] }),
  linkedSchedules: many(taskSchedules),
  linkedTasks: many(tasks),
}));

// Cycle table
export const cycles = sqliteTable('Cycle', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull(),
  name: text('name').notNull(),
  startDate: text('startDate').notNull(),
  endDate: text('endDate').notNull(),
  vision: text('vision'),
  theme: text('theme'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  userIdIdx: index('Cycle_userId_idx').on(table.userId),
}));


// Cycle relations
export const cyclesRelations = relations(cycles, ({ many }) => ({
  linkedSchedules: many(taskSchedules),
  linkedTasks: many(tasks),
  linkedGoals: many(goals),
}));

// Location Log table
export const locationLogs = sqliteTable('LocationLog', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull(),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  time: text('time'), // HH:MM (24h)
  notes: text('notes'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  userIdIdx: index('LocationLog_userId_idx').on(table.userId),
  dateIdx: index('LocationLog_date_idx').on(table.date),
  userDateIdx: index('LocationLog_userId_date_idx').on(table.userId, table.date),
}));
