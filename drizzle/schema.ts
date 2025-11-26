import { sqliteTable, text, integer, real, unique, index } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

// Activity table
export const activities = sqliteTable('Activity', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  icon: text('icon').notNull().default('--'),
  title: text('title').notNull().unique(),
  category: text('category').notNull(),
  color: text('color'),
  createdOn: integer('created_on', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Log table
export const logs = sqliteTable('Log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  comment: text('comment'),
  activityTitle: text('activityTitle').notNull(),
  activityCategory: text('activityCategory').notNull(),
  activityIcon: text('activityIcon').notNull(),
  activityColor: text('activityColor'),
  startTime: integer('start_time', { mode: 'timestamp' }),
  endTime: integer('end_time', { mode: 'timestamp' }),
  createdOn: integer('created_on', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  timeSpent: integer('time_spent'),
  tags: text('tags'),
  todoId: integer('todoId').references(() => todos.id, { onDelete: 'set null' }),
  goalId: integer('goalId').references(() => goals.id, { onDelete: 'set null' }),
  goalCount: integer('goalCount'),
  userId: text('userId'),
  placeId: integer('placeId'),
  contactIds: text('contactIds'),
}, (table) => ({
  todoIdIdx: index('Log_todoId_idx').on(table.todoId),
  goalIdIdx: index('Log_goalId_idx').on(table.goalId),
  placeIdIdx: index('Log_placeId_idx').on(table.placeId),
}));

// Todo table
export const todos = sqliteTable('Todo', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  activityTitle: text('activityTitle'),
  activityCategory: text('activityCategory'),
  deadline: text('deadline'),
  workDate: text('work_date'),
  done: integer('done', { mode: 'boolean' }).notNull().default(false),
  importance: integer('importance').notNull().default(1),
  urgency: integer('urgency').notNull().default(1),
  createdOn: integer('created_on', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  userId: text('userId'),
  // Recurring task fields
  isRecurring: integer('isRecurring', { mode: 'boolean' }).default(false),
  recurrencePattern: text('recurrencePattern'), // 'daily' | 'weekly' | 'monthly' | 'custom'
  recurrenceInterval: integer('recurrenceInterval'), // For custom: every N days
  recurrenceEndDate: text('recurrenceEndDate'), // End date for recurrence
  recurrenceCount: integer('recurrenceCount'), // OR number of occurrences
  workDateOffset: integer('workDateOffset'), // Days before deadline for work_date
  recurrenceGroupId: text('recurrenceGroupId'), // Links all instances together
  placeId: integer('placeId'),
  contactIds: text('contactIds'),
  goalId: integer('goalId'),
}, (table) => ({
  placeIdIdx: index('Todo_placeId_idx').on(table.placeId),
  goalIdIdx: index('Todo_goalId_idx').on(table.goalId),
}));

// Goal table
export const goals = sqliteTable('Goal', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  goalType: text('goalType').notNull(),
  metricType: text('metricType').notNull(),
  targetValue: real('targetValue').notNull(),
  currentValue: real('currentValue').notNull().default(0),
  periodType: text('periodType').notNull(),
  startDate: integer('startDate', { mode: 'timestamp' }).notNull(),
  endDate: integer('endDate', { mode: 'timestamp' }).notNull(),
  activityTitle: text('activityTitle'),
  activityCategory: text('activityCategory'),
  color: text('color'),
  icon: text('icon'),
  createdOn: integer('created_on', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  isRecurring: integer('isRecurring', { mode: 'boolean' }).notNull().default(false),
  recurrencePattern: text('recurrencePattern'),
  recurrenceConfig: text('recurrenceConfig'),
  parentGoalId: integer('parentGoalId'),
  userId: text('userId'),
  placeId: integer('placeId'),
  contactIds: text('contactIds'),
}, (table) => ({
  placeIdIdx: index('Goal_placeId_idx').on(table.placeId),
}));

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
  enableTodo: integer('enableTodo', { mode: 'boolean' }).notNull().default(false),
  enableGoals: integer('enableGoals', { mode: 'boolean' }).notNull().default(false),
  enablePeople: integer('enablePeople', { mode: 'boolean' }).notNull().default(false),
  enablePlaces: integer('enablePlaces', { mode: 'boolean' }).notNull().default(false),
  enableFinance: integer('enableFinance', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  userIdIdx: index('UserPreferences_userId_idx').on(table.userId),
}));

// Contact table
export const contacts = sqliteTable('Contact', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull(),
  googleId: text('googleId'),
  name: text('name').notNull(),
  email: text('email'),
  phoneNumber: text('phoneNumber'),
  photoUrl: text('photoUrl'),
  organization: text('organization'),
  jobTitle: text('jobTitle'),
  notes: text('notes'),
  address: text('address'),
  birthday: integer('birthday', { mode: 'timestamp' }),
  weddingAnniversary: integer('weddingAnniversary', { mode: 'timestamp' }),
  isIgnored: integer('isIgnored', { mode: 'boolean' }).notNull().default(false),
  lastSynced: integer('lastSynced', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  userIdGoogleIdUnique: unique().on(table.userId, table.googleId),
  userIdIdx: index('Contact_userId_idx').on(table.userId),
}));

// Place table
export const places = sqliteTable('Place', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull(),
  name: text('name').notNull(),
  address: text('address').notNull(),
  latitude: real('latitude'),
  longitude: real('longitude'),
  description: text('description'),
  category: text('category'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  userIdIdx: index('Place_userId_idx').on(table.userId),
}));

// FinanceAccount table
export const financeAccounts = sqliteTable('FinanceAccount', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull(),
  name: text('name').notNull(),
  currency: text('currency').notNull(),
  type: text('type').notNull(),
  balance: real('balance').notNull().default(0),
  description: text('description'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  userIdIdx: index('FinanceAccount_userId_idx').on(table.userId),
}));

// FinanceTransaction table
export const financeTransactions = sqliteTable('FinanceTransaction', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull(),
  fromAccountId: integer('fromAccountId').references(() => financeAccounts.id, { onDelete: 'cascade' }),
  toAccountId: integer('toAccountId').references(() => financeAccounts.id, { onDelete: 'cascade' }),
  amount: real('amount').notNull(),
  currency: text('currency').notNull(),
  exchangeRate: real('exchangeRate'),
  convertedAmount: real('convertedAmount'),
  type: text('type').notNull(),
  category: text('category'),
  description: text('description').notNull(),
  isNeed: integer('isNeed', { mode: 'boolean' }).notNull().default(true),
  transactionDate: integer('transactionDate', { mode: 'timestamp' }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  placeId: integer('placeId'),
  contactIds: text('contactIds'),
}, (table) => ({
  userIdIdx: index('FinanceTransaction_userId_idx').on(table.userId),
  fromAccountIdIdx: index('FinanceTransaction_fromAccountId_idx').on(table.fromAccountId),
  toAccountIdIdx: index('FinanceTransaction_toAccountId_idx').on(table.toAccountId),
  transactionDateIdx: index('FinanceTransaction_transactionDate_idx').on(table.transactionDate),
  placeIdIdx: index('FinanceTransaction_placeId_idx').on(table.placeId),
}));

// FinanceCategory table
export const financeCategories = sqliteTable('FinanceCategory', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  description: text('description'),
  color: text('color'),
  icon: text('icon'),
  isDefault: integer('isDefault', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  userIdNameTypeUnique: unique().on(table.userId, table.name, table.type),
  userIdIdx: index('FinanceCategory_userId_idx').on(table.userId),
  typeIdx: index('FinanceCategory_type_idx').on(table.type),
}));

// FinanceDebt table
export const financeDebts = sqliteTable('FinanceDebt', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  amount: real('amount').notNull(),
  remainingAmount: real('remainingAmount').notNull(),
  currency: text('currency').notNull(),
  interestRate: real('interestRate'),
  contactId: integer('contactId').references(() => contacts.id, { onDelete: 'set null' }),
  description: text('description'),
  dueDate: integer('dueDate', { mode: 'timestamp' }),
  startDate: integer('startDate', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  status: text('status').notNull().default('active'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  userIdIdx: index('FinanceDebt_userId_idx').on(table.userId),
  typeIdx: index('FinanceDebt_type_idx').on(table.type),
  statusIdx: index('FinanceDebt_status_idx').on(table.status),
  contactIdIdx: index('FinanceDebt_contactId_idx').on(table.contactId),
}));

// Relations
export const logsRelations = relations(logs, ({ one }) => ({
  todo: one(todos, {
    fields: [logs.todoId],
    references: [todos.id],
  }),
  goal: one(goals, {
    fields: [logs.goalId],
    references: [goals.id],
  }),
  place: one(places, {
    fields: [logs.placeId],
    references: [places.id],
  }),
}));

export const todosRelations = relations(todos, ({ one, many }) => ({
  logs: many(logs),
  place: one(places, {
    fields: [todos.placeId],
    references: [places.id],
  }),
  goal: one(goals, {
    fields: [todos.goalId],
    references: [goals.id],
  }),
}));

export const goalsRelations = relations(goals, ({ one, many }) => ({
  logs: many(logs),
  todos: many(todos),
  place: one(places, {
    fields: [goals.placeId],
    references: [places.id],
  }),
}));

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

export const contactsRelations = relations(contacts, ({ many }) => ({
  financeDebts: many(financeDebts),
}));

export const placesRelations = relations(places, ({ many }) => ({
  logs: many(logs),
  todos: many(todos),
  goals: many(goals),
  financeTransactions: many(financeTransactions),
}));

export const financeAccountsRelations = relations(financeAccounts, ({ many }) => ({
  transactionsFrom: many(financeTransactions, { relationName: 'fromAccount' }),
  transactionsTo: many(financeTransactions, { relationName: 'toAccount' }),
}));

export const financeTransactionsRelations = relations(financeTransactions, ({ one }) => ({
  fromAccount: one(financeAccounts, {
    fields: [financeTransactions.fromAccountId],
    references: [financeAccounts.id],
    relationName: 'fromAccount',
  }),
  toAccount: one(financeAccounts, {
    fields: [financeTransactions.toAccountId],
    references: [financeAccounts.id],
    relationName: 'toAccount',
  }),
  place: one(places, {
    fields: [financeTransactions.placeId],
    references: [places.id],
  }),
}));

export const financeDebtsRelations = relations(financeDebts, ({ one }) => ({
  contact: one(contacts, {
    fields: [financeDebts.contactId],
    references: [contacts.id],
  }),
}));
