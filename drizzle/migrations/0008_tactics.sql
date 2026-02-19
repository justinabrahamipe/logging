CREATE TABLE `TwelveWeekTactic` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`goalId` integer NOT NULL REFERENCES `TwelveWeekGoal`(`id`) ON DELETE cascade,
	`periodId` integer NOT NULL REFERENCES `TwelveWeekYear`(`id`) ON DELETE cascade,
	`userId` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`isCompleted` integer DEFAULT false NOT NULL,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `TwelveWeekTactic_goalId_idx` ON `TwelveWeekTactic` (`goalId`);
--> statement-breakpoint
CREATE INDEX `TwelveWeekTactic_periodId_idx` ON `TwelveWeekTactic` (`periodId`);
--> statement-breakpoint
CREATE INDEX `TwelveWeekTactic_userId_idx` ON `TwelveWeekTactic` (`userId`);
