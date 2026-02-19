CREATE TABLE `TwelveWeekYear` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`name` text NOT NULL,
	`startDate` text NOT NULL,
	`endDate` text NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `TwelveWeekYear_userId_idx` ON `TwelveWeekYear` (`userId`);
--> statement-breakpoint
CREATE TABLE `TwelveWeekGoal` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`periodId` integer NOT NULL REFERENCES `TwelveWeekYear`(`id`) ON DELETE cascade,
	`userId` text NOT NULL,
	`name` text NOT NULL,
	`targetValue` real NOT NULL,
	`currentValue` real DEFAULT 0 NOT NULL,
	`unit` text NOT NULL,
	`linkedOutcomeId` integer REFERENCES `Outcome`(`id`) ON DELETE set null,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `TwelveWeekGoal_periodId_idx` ON `TwelveWeekGoal` (`periodId`);
--> statement-breakpoint
CREATE INDEX `TwelveWeekGoal_userId_idx` ON `TwelveWeekGoal` (`userId`);
--> statement-breakpoint
CREATE TABLE `WeeklyTarget` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`goalId` integer NOT NULL REFERENCES `TwelveWeekGoal`(`id`) ON DELETE cascade,
	`periodId` integer NOT NULL REFERENCES `TwelveWeekYear`(`id`) ON DELETE cascade,
	`userId` text NOT NULL,
	`weekNumber` integer NOT NULL,
	`targetValue` real NOT NULL,
	`actualValue` real DEFAULT 0 NOT NULL,
	`isOverridden` integer DEFAULT false NOT NULL,
	`score` text,
	`reviewedAt` integer
);
--> statement-breakpoint
CREATE INDEX `WeeklyTarget_goalId_idx` ON `WeeklyTarget` (`goalId`);
--> statement-breakpoint
CREATE INDEX `WeeklyTarget_periodId_idx` ON `WeeklyTarget` (`periodId`);
--> statement-breakpoint
CREATE INDEX `WeeklyTarget_userId_idx` ON `WeeklyTarget` (`userId`);
--> statement-breakpoint
CREATE UNIQUE INDEX `WeeklyTarget_goalId_weekNumber_unique` ON `WeeklyTarget` (`goalId`, `weekNumber`);
