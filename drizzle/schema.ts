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
}, (table) => ({
  todoIdIdx: index('Log_todoId_idx').on(table.todoId),
  goalIdIdx: index('Log_goalId_idx').on(table.goalId),
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
});

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
});

// User table (lowercase for Auth.js compatibility)
export const users = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified', { mode: 'timestamp' }),
  image: text('image'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Account table (lowercase for Auth.js compatibility)
export const accounts = sqliteTable('account', {
  id: text('id').primaryKey(),
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
  id: text('id').primaryKey(),
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
  lastSynced: integer('lastSynced', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  userIdGoogleIdUnique: unique().on(table.userId, table.googleId),
  userIdIdx: index('Contact_userId_idx').on(table.userId),
}));

// IgnoredContact table
export const ignoredContacts = sqliteTable('IgnoredContact', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull(),
  googleId: text('googleId').notNull(),
  name: text('name'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  userIdGoogleIdUnique: unique().on(table.userId, table.googleId),
  userIdIdx: index('IgnoredContact_userId_idx').on(table.userId),
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

// PlaceContact junction table
export const placeContacts = sqliteTable('PlaceContact', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  placeId: integer('placeId').notNull().references(() => places.id, { onDelete: 'cascade' }),
  contactId: integer('contactId').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  placeIdContactIdUnique: unique().on(table.placeId, table.contactId),
  placeIdIdx: index('PlaceContact_placeId_idx').on(table.placeId),
  contactIdIdx: index('PlaceContact_contactId_idx').on(table.contactId),
}));

// LogContact junction table
export const logContacts = sqliteTable('LogContact', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  logId: integer('logId').notNull().references(() => logs.id, { onDelete: 'cascade' }),
  contactId: integer('contactId').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  logIdContactIdUnique: unique().on(table.logId, table.contactId),
  logIdIdx: index('LogContact_logId_idx').on(table.logId),
  contactIdIdx: index('LogContact_contactId_idx').on(table.contactId),
}));

// LogPlace junction table
export const logPlaces = sqliteTable('LogPlace', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  logId: integer('logId').notNull().references(() => logs.id, { onDelete: 'cascade' }),
  placeId: integer('placeId').notNull().references(() => places.id, { onDelete: 'cascade' }),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  logIdPlaceIdUnique: unique().on(table.logId, table.placeId),
  logIdIdx: index('LogPlace_logId_idx').on(table.logId),
  placeIdIdx: index('LogPlace_placeId_idx').on(table.placeId),
}));

// TodoContact junction table
export const todoContacts = sqliteTable('TodoContact', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  todoId: integer('todoId').notNull().references(() => todos.id, { onDelete: 'cascade' }),
  contactId: integer('contactId').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  todoIdContactIdUnique: unique().on(table.todoId, table.contactId),
  todoIdIdx: index('TodoContact_todoId_idx').on(table.todoId),
  contactIdIdx: index('TodoContact_contactId_idx').on(table.contactId),
}));

// TodoPlace junction table
export const todoPlaces = sqliteTable('TodoPlace', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  todoId: integer('todoId').notNull().references(() => todos.id, { onDelete: 'cascade' }),
  placeId: integer('placeId').notNull().references(() => places.id, { onDelete: 'cascade' }),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  todoIdPlaceIdUnique: unique().on(table.todoId, table.placeId),
  todoIdIdx: index('TodoPlace_todoId_idx').on(table.todoId),
  placeIdIdx: index('TodoPlace_placeId_idx').on(table.placeId),
}));

// GoalContact junction table
export const goalContacts = sqliteTable('GoalContact', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  goalId: integer('goalId').notNull().references(() => goals.id, { onDelete: 'cascade' }),
  contactId: integer('contactId').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  goalIdContactIdUnique: unique().on(table.goalId, table.contactId),
  goalIdIdx: index('GoalContact_goalId_idx').on(table.goalId),
  contactIdIdx: index('GoalContact_contactId_idx').on(table.contactId),
}));

// GoalPlace junction table
export const goalPlaces = sqliteTable('GoalPlace', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  goalId: integer('goalId').notNull().references(() => goals.id, { onDelete: 'cascade' }),
  placeId: integer('placeId').notNull().references(() => places.id, { onDelete: 'cascade' }),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  goalIdPlaceIdUnique: unique().on(table.goalId, table.placeId),
  goalIdIdx: index('GoalPlace_goalId_idx').on(table.goalId),
  placeIdIdx: index('GoalPlace_placeId_idx').on(table.placeId),
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
}, (table) => ({
  userIdIdx: index('FinanceTransaction_userId_idx').on(table.userId),
  fromAccountIdIdx: index('FinanceTransaction_fromAccountId_idx').on(table.fromAccountId),
  toAccountIdIdx: index('FinanceTransaction_toAccountId_idx').on(table.toAccountId),
  transactionDateIdx: index('FinanceTransaction_transactionDate_idx').on(table.transactionDate),
}));

// FinanceTransactionContact junction table
export const financeTransactionContacts = sqliteTable('FinanceTransactionContact', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  transactionId: integer('transactionId').notNull().references(() => financeTransactions.id, { onDelete: 'cascade' }),
  contactId: integer('contactId').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  transactionIdContactIdUnique: unique().on(table.transactionId, table.contactId),
  transactionIdIdx: index('FinanceTransactionContact_transactionId_idx').on(table.transactionId),
  contactIdIdx: index('FinanceTransactionContact_contactId_idx').on(table.contactId),
}));

// FinanceTransactionPlace junction table
export const financeTransactionPlaces = sqliteTable('FinanceTransactionPlace', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  transactionId: integer('transactionId').notNull().references(() => financeTransactions.id, { onDelete: 'cascade' }),
  placeId: integer('placeId').notNull().references(() => places.id, { onDelete: 'cascade' }),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  transactionIdPlaceIdUnique: unique().on(table.transactionId, table.placeId),
  transactionIdIdx: index('FinanceTransactionPlace_transactionId_idx').on(table.transactionId),
  placeIdIdx: index('FinanceTransactionPlace_placeId_idx').on(table.placeId),
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
export const logsRelations = relations(logs, ({ one, many }) => ({
  todo: one(todos, {
    fields: [logs.todoId],
    references: [todos.id],
  }),
  goal: one(goals, {
    fields: [logs.goalId],
    references: [goals.id],
  }),
  logContacts: many(logContacts),
  logPlaces: many(logPlaces),
}));

export const todosRelations = relations(todos, ({ many }) => ({
  logs: many(logs),
  todoContacts: many(todoContacts),
  todoPlaces: many(todoPlaces),
}));

export const goalsRelations = relations(goals, ({ many }) => ({
  logs: many(logs),
  goalContacts: many(goalContacts),
  goalPlaces: many(goalPlaces),
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
  placeContacts: many(placeContacts),
  logContacts: many(logContacts),
  todoContacts: many(todoContacts),
  goalContacts: many(goalContacts),
  financeTransactionContacts: many(financeTransactionContacts),
  financeDebts: many(financeDebts),
}));

export const placesRelations = relations(places, ({ many }) => ({
  placeContacts: many(placeContacts),
  logPlaces: many(logPlaces),
  todoPlaces: many(todoPlaces),
  goalPlaces: many(goalPlaces),
  financeTransactionPlaces: many(financeTransactionPlaces),
}));

export const placeContactsRelations = relations(placeContacts, ({ one }) => ({
  place: one(places, {
    fields: [placeContacts.placeId],
    references: [places.id],
  }),
  contact: one(contacts, {
    fields: [placeContacts.contactId],
    references: [contacts.id],
  }),
}));

export const logContactsRelations = relations(logContacts, ({ one }) => ({
  log: one(logs, {
    fields: [logContacts.logId],
    references: [logs.id],
  }),
  contact: one(contacts, {
    fields: [logContacts.contactId],
    references: [contacts.id],
  }),
}));

export const logPlacesRelations = relations(logPlaces, ({ one }) => ({
  log: one(logs, {
    fields: [logPlaces.logId],
    references: [logs.id],
  }),
  place: one(places, {
    fields: [logPlaces.placeId],
    references: [places.id],
  }),
}));

export const todoContactsRelations = relations(todoContacts, ({ one }) => ({
  todo: one(todos, {
    fields: [todoContacts.todoId],
    references: [todos.id],
  }),
  contact: one(contacts, {
    fields: [todoContacts.contactId],
    references: [contacts.id],
  }),
}));

export const todoPlacesRelations = relations(todoPlaces, ({ one }) => ({
  todo: one(todos, {
    fields: [todoPlaces.todoId],
    references: [todos.id],
  }),
  place: one(places, {
    fields: [todoPlaces.placeId],
    references: [places.id],
  }),
}));

export const goalContactsRelations = relations(goalContacts, ({ one }) => ({
  goal: one(goals, {
    fields: [goalContacts.goalId],
    references: [goals.id],
  }),
  contact: one(contacts, {
    fields: [goalContacts.contactId],
    references: [contacts.id],
  }),
}));

export const goalPlacesRelations = relations(goalPlaces, ({ one }) => ({
  goal: one(goals, {
    fields: [goalPlaces.goalId],
    references: [goals.id],
  }),
  place: one(places, {
    fields: [goalPlaces.placeId],
    references: [places.id],
  }),
}));

export const financeAccountsRelations = relations(financeAccounts, ({ many }) => ({
  transactionsFrom: many(financeTransactions, { relationName: 'fromAccount' }),
  transactionsTo: many(financeTransactions, { relationName: 'toAccount' }),
}));

export const financeTransactionsRelations = relations(financeTransactions, ({ one, many }) => ({
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
  transactionContacts: many(financeTransactionContacts),
  transactionPlaces: many(financeTransactionPlaces),
}));

export const financeTransactionContactsRelations = relations(financeTransactionContacts, ({ one }) => ({
  transaction: one(financeTransactions, {
    fields: [financeTransactionContacts.transactionId],
    references: [financeTransactions.id],
  }),
  contact: one(contacts, {
    fields: [financeTransactionContacts.contactId],
    references: [contacts.id],
  }),
}));

export const financeTransactionPlacesRelations = relations(financeTransactionPlaces, ({ one }) => ({
  transaction: one(financeTransactions, {
    fields: [financeTransactionPlaces.transactionId],
    references: [financeTransactions.id],
  }),
  place: one(places, {
    fields: [financeTransactionPlaces.placeId],
    references: [places.id],
  }),
}));

export const financeDebtsRelations = relations(financeDebts, ({ one }) => ({
  contact: one(contacts, {
    fields: [financeDebts.contactId],
    references: [contacts.id],
  }),
}));
