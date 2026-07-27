CREATE TABLE `WeeklyReview` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`periodId` integer NOT NULL REFERENCES `TwelveWeekYear`(`id`) ON DELETE cascade,
	`userId` text NOT NULL,
	`weekNumber` integer NOT NULL,
	`notes` text,
	`wins` text,
	`blockers` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `WeeklyReview_periodId_idx` ON `WeeklyReview` (`periodId`);
--> statement-breakpoint
CREATE INDEX `WeeklyReview_userId_idx` ON `WeeklyReview` (`userId`);
--> statement-breakpoint
CREATE UNIQUE INDEX `WeeklyReview_periodId_weekNumber_unique` ON `WeeklyReview` (`periodId`, `weekNumber`);
