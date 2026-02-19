-- Drop old tables
DROP TABLE IF EXISTS `Activity`;--> statement-breakpoint
DROP TABLE IF EXISTS `Log`;--> statement-breakpoint
DROP TABLE IF EXISTS `Todo`;--> statement-breakpoint
DROP TABLE IF EXISTS `Goal`;--> statement-breakpoint
DROP TABLE IF EXISTS `Contact`;--> statement-breakpoint
DROP TABLE IF EXISTS `Place`;--> statement-breakpoint

-- Remove old columns from UserPreferences and add new ones
ALTER TABLE `UserPreferences` DROP COLUMN `enableTodo`;--> statement-breakpoint
ALTER TABLE `UserPreferences` DROP COLUMN `enableGoals`;--> statement-breakpoint
ALTER TABLE `UserPreferences` DROP COLUMN `enablePeople`;--> statement-breakpoint
ALTER TABLE `UserPreferences` DROP COLUMN `enablePlaces`;--> statement-breakpoint
ALTER TABLE `UserPreferences` ADD `weekdayPassThreshold` integer DEFAULT 70 NOT NULL;--> statement-breakpoint
ALTER TABLE `UserPreferences` ADD `weekendPassThreshold` integer DEFAULT 70 NOT NULL;--> statement-breakpoint

-- Remove place/contact references from finance tables
DROP INDEX IF EXISTS `FinanceTransaction_placeId_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `FinanceDebt_contactId_idx`;--> statement-breakpoint

-- Create Pillar table
CREATE TABLE `Pillar` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `userId` text NOT NULL,
  `name` text NOT NULL,
  `emoji` text DEFAULT '📌' NOT NULL,
  `color` text DEFAULT '#3B82F6' NOT NULL,
  `weight` real DEFAULT 0 NOT NULL,
  `description` text,
  `isArchived` integer DEFAULT false NOT NULL,
  `sortOrder` integer DEFAULT 0 NOT NULL,
  `createdAt` integer DEFAULT (unixepoch()) NOT NULL,
  `updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);--> statement-breakpoint
CREATE INDEX `Pillar_userId_idx` ON `Pillar` (`userId`);--> statement-breakpoint

-- Create Task table
CREATE TABLE `Task` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `pillarId` integer NOT NULL REFERENCES `Pillar`(`id`) ON DELETE CASCADE,
  `userId` text NOT NULL,
  `name` text NOT NULL,
  `completionType` text DEFAULT 'checkbox' NOT NULL,
  `target` real,
  `unit` text,
  `flexibilityRule` text DEFAULT 'must_today' NOT NULL,
  `windowStart` integer,
  `windowEnd` integer,
  `limitValue` real,
  `importance` text DEFAULT 'medium' NOT NULL,
  `frequency` text DEFAULT 'daily' NOT NULL,
  `customDays` text,
  `isWeekendTask` integer DEFAULT false NOT NULL,
  `basePoints` real DEFAULT 10 NOT NULL,
  `isActive` integer DEFAULT true NOT NULL,
  `createdAt` integer DEFAULT (unixepoch()) NOT NULL,
  `updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);--> statement-breakpoint
CREATE INDEX `Task_userId_idx` ON `Task` (`userId`);--> statement-breakpoint
CREATE INDEX `Task_pillarId_idx` ON `Task` (`pillarId`);--> statement-breakpoint

-- Create TaskCompletion table
CREATE TABLE `TaskCompletion` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `taskId` integer NOT NULL REFERENCES `Task`(`id`) ON DELETE CASCADE,
  `userId` text NOT NULL,
  `date` text NOT NULL,
  `completed` integer DEFAULT false NOT NULL,
  `value` real,
  `pointsEarned` real DEFAULT 0 NOT NULL,
  `completedAt` integer,
  `updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);--> statement-breakpoint
CREATE INDEX `TaskCompletion_userId_idx` ON `TaskCompletion` (`userId`);--> statement-breakpoint
CREATE INDEX `TaskCompletion_taskId_idx` ON `TaskCompletion` (`taskId`);--> statement-breakpoint
CREATE INDEX `TaskCompletion_date_idx` ON `TaskCompletion` (`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `TaskCompletion_taskId_date_unique` ON `TaskCompletion` (`taskId`, `date`);--> statement-breakpoint

-- Create DailyScore table
CREATE TABLE `DailyScore` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `userId` text NOT NULL,
  `date` text NOT NULL,
  `actionScore` real DEFAULT 0 NOT NULL,
  `pillarScores` text,
  `xpEarned` real DEFAULT 0 NOT NULL,
  `streakBonus` real DEFAULT 0 NOT NULL,
  `isPassing` integer DEFAULT false NOT NULL,
  `createdAt` integer DEFAULT (unixepoch()) NOT NULL,
  `updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);--> statement-breakpoint
CREATE INDEX `DailyScore_userId_idx` ON `DailyScore` (`userId`);--> statement-breakpoint
CREATE INDEX `DailyScore_date_idx` ON `DailyScore` (`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `DailyScore_userId_date_unique` ON `DailyScore` (`userId`, `date`);--> statement-breakpoint

-- Create UserStats table
CREATE TABLE `UserStats` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `userId` text NOT NULL,
  `totalXp` real DEFAULT 0 NOT NULL,
  `level` integer DEFAULT 1 NOT NULL,
  `levelTitle` text DEFAULT 'Beginner' NOT NULL,
  `currentStreak` integer DEFAULT 0 NOT NULL,
  `bestStreak` integer DEFAULT 0 NOT NULL,
  `updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);--> statement-breakpoint
CREATE INDEX `UserStats_userId_idx` ON `UserStats` (`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX `UserStats_userId_unique` ON `UserStats` (`userId`);
