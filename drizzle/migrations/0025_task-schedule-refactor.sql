-- Step 1: Create TaskSchedule table (mirrors old Task schema)
CREATE TABLE IF NOT EXISTS `TaskSchedule` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `pillarId` integer REFERENCES `Pillar`(`id`) ON DELETE SET NULL,
  `userId` text NOT NULL,
  `name` text NOT NULL,
  `completionType` text NOT NULL DEFAULT 'checkbox',
  `target` real,
  `unit` text,
  `flexibilityRule` text NOT NULL DEFAULT 'must_today',
  `limitValue` real,
  `frequency` text NOT NULL DEFAULT 'daily',
  `customDays` text,
  `repeatInterval` integer,
  `basePoints` real NOT NULL DEFAULT 10,
  `goalId` integer REFERENCES `Goal`(`id`) ON DELETE SET NULL,
  `periodId` integer REFERENCES `Cycle`(`id`) ON DELETE SET NULL,
  `startDate` text,
  `isActive` integer NOT NULL DEFAULT 1,
  `createdAt` integer NOT NULL DEFAULT (unixepoch()),
  `updatedAt` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `TaskSchedule_userId_idx` ON `TaskSchedule` (`userId`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `TaskSchedule_pillarId_idx` ON `TaskSchedule` (`pillarId`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `TaskSchedule_goalId_idx` ON `TaskSchedule` (`goalId`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `TaskSchedule_periodId_idx` ON `TaskSchedule` (`periodId`);
--> statement-breakpoint
-- Step 2: Copy all existing Task rows into TaskSchedule (preserving IDs)
INSERT INTO `TaskSchedule` (`id`, `pillarId`, `userId`, `name`, `completionType`, `target`, `unit`,
  `flexibilityRule`, `limitValue`, `frequency`, `customDays`, `repeatInterval`, `basePoints`,
  `goalId`, `periodId`, `startDate`, `isActive`, `createdAt`, `updatedAt`)
SELECT `id`, `pillarId`, `userId`, `name`, `completionType`, `target`, `unit`,
  `flexibilityRule`, `limitValue`, `frequency`, `customDays`, `repeatInterval`, `basePoints`,
  `goalId`, `periodId`, `startDate`, `isActive`, `createdAt`, `updatedAt`
FROM `Task`;
--> statement-breakpoint
-- Step 3: Create the new Task table with completion columns
CREATE TABLE `Task_new` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `scheduleId` integer REFERENCES `TaskSchedule`(`id`) ON DELETE SET NULL,
  `pillarId` integer REFERENCES `Pillar`(`id`) ON DELETE SET NULL,
  `userId` text NOT NULL,
  `name` text NOT NULL,
  `completionType` text NOT NULL DEFAULT 'checkbox',
  `target` real,
  `unit` text,
  `flexibilityRule` text NOT NULL DEFAULT 'must_today',
  `limitValue` real,
  `basePoints` real NOT NULL DEFAULT 10,
  `goalId` integer REFERENCES `Goal`(`id`) ON DELETE SET NULL,
  `periodId` integer REFERENCES `Cycle`(`id`) ON DELETE SET NULL,
  `date` text NOT NULL,
  `completed` integer NOT NULL DEFAULT 0,
  `value` real,
  `pointsEarned` real NOT NULL DEFAULT 0,
  `isHighlighted` integer NOT NULL DEFAULT 0,
  `completedAt` integer,
  `isActive` integer NOT NULL DEFAULT 1,
  `createdAt` integer NOT NULL DEFAULT (unixepoch()),
  `updatedAt` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint
-- Step 4: Migrate TaskCompletion data into new Task rows
INSERT INTO `Task_new` (`scheduleId`, `pillarId`, `userId`, `name`, `completionType`, `target`, `unit`,
  `flexibilityRule`, `limitValue`, `basePoints`, `goalId`, `periodId`, `date`,
  `completed`, `value`, `pointsEarned`, `isHighlighted`, `completedAt`, `isActive`, `createdAt`, `updatedAt`)
SELECT t.`id`, t.`pillarId`, t.`userId`, t.`name`, t.`completionType`, t.`target`, t.`unit`,
  t.`flexibilityRule`, t.`limitValue`, t.`basePoints`, t.`goalId`, t.`periodId`, tc.`date`,
  tc.`completed`, tc.`value`, tc.`pointsEarned`, tc.`isHighlighted`, tc.`completedAt`,
  t.`isActive`, tc.`updatedAt`, tc.`updatedAt`
FROM `TaskCompletion` tc
INNER JOIN `Task` t ON tc.`taskId` = t.`id`;
--> statement-breakpoint
-- Step 5: Drop old tables and rename
DROP TABLE IF EXISTS `TaskCompletion`;
--> statement-breakpoint
DROP TABLE `Task`;
--> statement-breakpoint
ALTER TABLE `Task_new` RENAME TO `Task`;
--> statement-breakpoint
-- Step 6: Recreate indexes on new Task table
CREATE INDEX `Task_userId_idx` ON `Task` (`userId`);
--> statement-breakpoint
CREATE INDEX `Task_pillarId_idx` ON `Task` (`pillarId`);
--> statement-breakpoint
CREATE INDEX `Task_goalId_idx` ON `Task` (`goalId`);
--> statement-breakpoint
CREATE INDEX `Task_periodId_idx` ON `Task` (`periodId`);
--> statement-breakpoint
CREATE INDEX `Task_date_idx` ON `Task` (`date`);
--> statement-breakpoint
CREATE INDEX `Task_userId_date_idx` ON `Task` (`userId`, `date`);
--> statement-breakpoint
CREATE UNIQUE INDEX `Task_scheduleId_date_unique` ON `Task` (`scheduleId`, `date`);
