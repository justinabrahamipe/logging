CREATE TABLE IF NOT EXISTS `Outcome` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`pillarId` integer REFERENCES `Pillar`(`id`) ON DELETE set null,
	`name` text NOT NULL,
	`startValue` real NOT NULL,
	`targetValue` real NOT NULL,
	`currentValue` real NOT NULL,
	`unit` text NOT NULL,
	`direction` text NOT NULL,
	`logFrequency` text DEFAULT 'weekly' NOT NULL,
	`targetDate` text,
	`periodId` integer REFERENCES `TwelveWeekYear`(`id`) ON DELETE set null,
	`isArchived` integer DEFAULT false NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `Outcome_userId_idx` ON `Outcome` (`userId`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `Outcome_pillarId_idx` ON `Outcome` (`pillarId`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `Outcome_periodId_idx` ON `Outcome` (`periodId`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `OutcomeLog` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`outcomeId` integer NOT NULL REFERENCES `Outcome`(`id`) ON DELETE cascade,
	`userId` text NOT NULL,
	`value` real NOT NULL,
	`loggedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`note` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `OutcomeLog_outcomeId_idx` ON `OutcomeLog` (`outcomeId`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `OutcomeLog_userId_idx` ON `OutcomeLog` (`userId`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ActivityLog` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`timestamp` integer DEFAULT (unixepoch()) NOT NULL,
	`taskId` integer REFERENCES `Task`(`id`) ON DELETE set null,
	`pillarId` integer REFERENCES `Pillar`(`id`) ON DELETE set null,
	`action` text NOT NULL,
	`previousValue` real,
	`newValue` real,
	`delta` real,
	`pointsBefore` real,
	`pointsAfter` real,
	`pointsDelta` real,
	`source` text DEFAULT 'manual' NOT NULL,
	`reversalOf` integer,
	`note` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ActivityLog_userId_idx` ON `ActivityLog` (`userId`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ActivityLog_taskId_idx` ON `ActivityLog` (`taskId`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ActivityLog_timestamp_idx` ON `ActivityLog` (`timestamp`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `GeneratedReport` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL REFERENCES `user`(`id`) ON DELETE cascade,
	`type` text NOT NULL,
	`periodStart` text NOT NULL,
	`periodEnd` text NOT NULL,
	`data` text NOT NULL,
	`generatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `GeneratedReport_userId_idx` ON `GeneratedReport` (`userId`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `GeneratedReport_userId_type_periodStart_unique` ON `GeneratedReport` (`userId`, `type`, `periodStart`);
