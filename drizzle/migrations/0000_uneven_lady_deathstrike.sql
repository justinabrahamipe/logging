CREATE TABLE `Account` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`providerAccountId` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Account_userId_idx` ON `Account` (`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX `Account_provider_providerAccountId_unique` ON `Account` (`provider`,`providerAccountId`);--> statement-breakpoint
CREATE TABLE `Activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`icon` text DEFAULT '--' NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`color` text,
	`created_on` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Activity_title_unique` ON `Activity` (`title`);--> statement-breakpoint
CREATE TABLE `Contact` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`googleId` text,
	`name` text NOT NULL,
	`email` text,
	`phoneNumber` text,
	`photoUrl` text,
	`organization` text,
	`jobTitle` text,
	`notes` text,
	`address` text,
	`birthday` integer,
	`weddingAnniversary` integer,
	`lastSynced` integer DEFAULT (unixepoch()) NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `Contact_userId_idx` ON `Contact` (`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX `Contact_userId_googleId_unique` ON `Contact` (`userId`,`googleId`);--> statement-breakpoint
CREATE TABLE `FinanceAccount` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`name` text NOT NULL,
	`currency` text NOT NULL,
	`type` text NOT NULL,
	`balance` real DEFAULT 0 NOT NULL,
	`description` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `FinanceAccount_userId_idx` ON `FinanceAccount` (`userId`);--> statement-breakpoint
CREATE TABLE `FinanceCategory` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`description` text,
	`color` text,
	`icon` text,
	`isDefault` integer DEFAULT false NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `FinanceCategory_userId_idx` ON `FinanceCategory` (`userId`);--> statement-breakpoint
CREATE INDEX `FinanceCategory_type_idx` ON `FinanceCategory` (`type`);--> statement-breakpoint
CREATE UNIQUE INDEX `FinanceCategory_userId_name_type_unique` ON `FinanceCategory` (`userId`,`name`,`type`);--> statement-breakpoint
CREATE TABLE `FinanceDebt` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`remainingAmount` real NOT NULL,
	`currency` text NOT NULL,
	`interestRate` real,
	`contactId` integer,
	`description` text,
	`dueDate` integer,
	`startDate` integer DEFAULT (unixepoch()) NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`contactId`) REFERENCES `Contact`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `FinanceDebt_userId_idx` ON `FinanceDebt` (`userId`);--> statement-breakpoint
CREATE INDEX `FinanceDebt_type_idx` ON `FinanceDebt` (`type`);--> statement-breakpoint
CREATE INDEX `FinanceDebt_status_idx` ON `FinanceDebt` (`status`);--> statement-breakpoint
CREATE INDEX `FinanceDebt_contactId_idx` ON `FinanceDebt` (`contactId`);--> statement-breakpoint
CREATE TABLE `FinanceTransactionContact` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`transactionId` integer NOT NULL,
	`contactId` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`transactionId`) REFERENCES `FinanceTransaction`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contactId`) REFERENCES `Contact`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `FinanceTransactionContact_transactionId_idx` ON `FinanceTransactionContact` (`transactionId`);--> statement-breakpoint
CREATE INDEX `FinanceTransactionContact_contactId_idx` ON `FinanceTransactionContact` (`contactId`);--> statement-breakpoint
CREATE UNIQUE INDEX `FinanceTransactionContact_transactionId_contactId_unique` ON `FinanceTransactionContact` (`transactionId`,`contactId`);--> statement-breakpoint
CREATE TABLE `FinanceTransactionPlace` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`transactionId` integer NOT NULL,
	`placeId` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`transactionId`) REFERENCES `FinanceTransaction`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`placeId`) REFERENCES `Place`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `FinanceTransactionPlace_transactionId_idx` ON `FinanceTransactionPlace` (`transactionId`);--> statement-breakpoint
CREATE INDEX `FinanceTransactionPlace_placeId_idx` ON `FinanceTransactionPlace` (`placeId`);--> statement-breakpoint
CREATE UNIQUE INDEX `FinanceTransactionPlace_transactionId_placeId_unique` ON `FinanceTransactionPlace` (`transactionId`,`placeId`);--> statement-breakpoint
CREATE TABLE `FinanceTransaction` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`fromAccountId` integer,
	`toAccountId` integer,
	`amount` real NOT NULL,
	`currency` text NOT NULL,
	`exchangeRate` real,
	`convertedAmount` real,
	`type` text NOT NULL,
	`category` text,
	`description` text NOT NULL,
	`isNeed` integer DEFAULT true NOT NULL,
	`transactionDate` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`fromAccountId`) REFERENCES `FinanceAccount`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`toAccountId`) REFERENCES `FinanceAccount`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `FinanceTransaction_userId_idx` ON `FinanceTransaction` (`userId`);--> statement-breakpoint
CREATE INDEX `FinanceTransaction_fromAccountId_idx` ON `FinanceTransaction` (`fromAccountId`);--> statement-breakpoint
CREATE INDEX `FinanceTransaction_toAccountId_idx` ON `FinanceTransaction` (`toAccountId`);--> statement-breakpoint
CREATE INDEX `FinanceTransaction_transactionDate_idx` ON `FinanceTransaction` (`transactionDate`);--> statement-breakpoint
CREATE TABLE `GoalContact` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`goalId` integer NOT NULL,
	`contactId` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`goalId`) REFERENCES `Goal`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contactId`) REFERENCES `Contact`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `GoalContact_goalId_idx` ON `GoalContact` (`goalId`);--> statement-breakpoint
CREATE INDEX `GoalContact_contactId_idx` ON `GoalContact` (`contactId`);--> statement-breakpoint
CREATE UNIQUE INDEX `GoalContact_goalId_contactId_unique` ON `GoalContact` (`goalId`,`contactId`);--> statement-breakpoint
CREATE TABLE `GoalPlace` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`goalId` integer NOT NULL,
	`placeId` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`goalId`) REFERENCES `Goal`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`placeId`) REFERENCES `Place`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `GoalPlace_goalId_idx` ON `GoalPlace` (`goalId`);--> statement-breakpoint
CREATE INDEX `GoalPlace_placeId_idx` ON `GoalPlace` (`placeId`);--> statement-breakpoint
CREATE UNIQUE INDEX `GoalPlace_goalId_placeId_unique` ON `GoalPlace` (`goalId`,`placeId`);--> statement-breakpoint
CREATE TABLE `Goal` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`goalType` text NOT NULL,
	`metricType` text NOT NULL,
	`targetValue` real NOT NULL,
	`currentValue` real DEFAULT 0 NOT NULL,
	`periodType` text NOT NULL,
	`startDate` integer NOT NULL,
	`endDate` integer NOT NULL,
	`activityTitle` text,
	`activityCategory` text,
	`color` text,
	`icon` text,
	`created_on` integer DEFAULT (unixepoch()) NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`isRecurring` integer DEFAULT false NOT NULL,
	`recurrencePattern` text,
	`recurrenceConfig` text,
	`parentGoalId` integer,
	`userId` text
);
--> statement-breakpoint
CREATE TABLE `IgnoredContact` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`googleId` text NOT NULL,
	`name` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `IgnoredContact_userId_idx` ON `IgnoredContact` (`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX `IgnoredContact_userId_googleId_unique` ON `IgnoredContact` (`userId`,`googleId`);--> statement-breakpoint
CREATE TABLE `LogContact` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`logId` integer NOT NULL,
	`contactId` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`logId`) REFERENCES `Log`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contactId`) REFERENCES `Contact`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `LogContact_logId_idx` ON `LogContact` (`logId`);--> statement-breakpoint
CREATE INDEX `LogContact_contactId_idx` ON `LogContact` (`contactId`);--> statement-breakpoint
CREATE UNIQUE INDEX `LogContact_logId_contactId_unique` ON `LogContact` (`logId`,`contactId`);--> statement-breakpoint
CREATE TABLE `LogPlace` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`logId` integer NOT NULL,
	`placeId` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`logId`) REFERENCES `Log`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`placeId`) REFERENCES `Place`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `LogPlace_logId_idx` ON `LogPlace` (`logId`);--> statement-breakpoint
CREATE INDEX `LogPlace_placeId_idx` ON `LogPlace` (`placeId`);--> statement-breakpoint
CREATE UNIQUE INDEX `LogPlace_logId_placeId_unique` ON `LogPlace` (`logId`,`placeId`);--> statement-breakpoint
CREATE TABLE `Log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`comment` text,
	`activityTitle` text NOT NULL,
	`activityCategory` text NOT NULL,
	`activityIcon` text NOT NULL,
	`activityColor` text,
	`start_time` integer,
	`end_time` integer,
	`created_on` integer DEFAULT (unixepoch()) NOT NULL,
	`time_spent` integer,
	`tags` text,
	`todoId` integer,
	`goalId` integer,
	`goalCount` integer,
	`userId` text,
	FOREIGN KEY (`todoId`) REFERENCES `Todo`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`goalId`) REFERENCES `Goal`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `Log_todoId_idx` ON `Log` (`todoId`);--> statement-breakpoint
CREATE INDEX `Log_goalId_idx` ON `Log` (`goalId`);--> statement-breakpoint
CREATE TABLE `PlaceContact` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`placeId` integer NOT NULL,
	`contactId` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`placeId`) REFERENCES `Place`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contactId`) REFERENCES `Contact`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `PlaceContact_placeId_idx` ON `PlaceContact` (`placeId`);--> statement-breakpoint
CREATE INDEX `PlaceContact_contactId_idx` ON `PlaceContact` (`contactId`);--> statement-breakpoint
CREATE UNIQUE INDEX `PlaceContact_placeId_contactId_unique` ON `PlaceContact` (`placeId`,`contactId`);--> statement-breakpoint
CREATE TABLE `Place` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`name` text NOT NULL,
	`address` text NOT NULL,
	`latitude` real,
	`longitude` real,
	`description` text,
	`category` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `Place_userId_idx` ON `Place` (`userId`);--> statement-breakpoint
CREATE TABLE `Session` (
	`id` text PRIMARY KEY NOT NULL,
	`sessionToken` text NOT NULL,
	`userId` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Session_sessionToken_unique` ON `Session` (`sessionToken`);--> statement-breakpoint
CREATE INDEX `Session_userId_idx` ON `Session` (`userId`);--> statement-breakpoint
CREATE TABLE `TodoContact` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`todoId` integer NOT NULL,
	`contactId` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`todoId`) REFERENCES `Todo`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contactId`) REFERENCES `Contact`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `TodoContact_todoId_idx` ON `TodoContact` (`todoId`);--> statement-breakpoint
CREATE INDEX `TodoContact_contactId_idx` ON `TodoContact` (`contactId`);--> statement-breakpoint
CREATE UNIQUE INDEX `TodoContact_todoId_contactId_unique` ON `TodoContact` (`todoId`,`contactId`);--> statement-breakpoint
CREATE TABLE `TodoPlace` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`todoId` integer NOT NULL,
	`placeId` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`todoId`) REFERENCES `Todo`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`placeId`) REFERENCES `Place`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `TodoPlace_todoId_idx` ON `TodoPlace` (`todoId`);--> statement-breakpoint
CREATE INDEX `TodoPlace_placeId_idx` ON `TodoPlace` (`placeId`);--> statement-breakpoint
CREATE UNIQUE INDEX `TodoPlace_todoId_placeId_unique` ON `TodoPlace` (`todoId`,`placeId`);--> statement-breakpoint
CREATE TABLE `Todo` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`activityTitle` text,
	`activityCategory` text,
	`deadline` text,
	`work_date` text,
	`done` integer DEFAULT false NOT NULL,
	`importance` integer DEFAULT 1 NOT NULL,
	`urgency` integer DEFAULT 1 NOT NULL,
	`created_on` integer DEFAULT (unixepoch()) NOT NULL,
	`userId` text
);
--> statement-breakpoint
CREATE TABLE `UserPreferences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`theme` text DEFAULT 'light' NOT NULL,
	`timeFormat` text DEFAULT '12h' NOT NULL,
	`dateFormat` text DEFAULT 'DD/MM/YYYY' NOT NULL,
	`enableTodo` integer DEFAULT false NOT NULL,
	`enableGoals` integer DEFAULT false NOT NULL,
	`enablePeople` integer DEFAULT false NOT NULL,
	`enablePlaces` integer DEFAULT false NOT NULL,
	`enableFinance` integer DEFAULT false NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `UserPreferences_userId_unique` ON `UserPreferences` (`userId`);--> statement-breakpoint
CREATE INDEX `UserPreferences_userId_idx` ON `UserPreferences` (`userId`);--> statement-breakpoint
CREATE TABLE `User` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`emailVerified` integer,
	`image` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `User_email_unique` ON `User` (`email`);--> statement-breakpoint
CREATE TABLE `VerificationToken` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `VerificationToken_token_unique` ON `VerificationToken` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `VerificationToken_identifier_token_unique` ON `VerificationToken` (`identifier`,`token`);