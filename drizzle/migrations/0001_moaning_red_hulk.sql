CREATE TABLE `TodoGoal` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`todoId` integer NOT NULL,
	`goalId` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`todoId`) REFERENCES `Todo`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`goalId`) REFERENCES `Goal`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `TodoGoal_todoId_idx` ON `TodoGoal` (`todoId`);--> statement-breakpoint
CREATE INDEX `TodoGoal_goalId_idx` ON `TodoGoal` (`goalId`);--> statement-breakpoint
CREATE UNIQUE INDEX `TodoGoal_todoId_goalId_unique` ON `TodoGoal` (`todoId`,`goalId`);--> statement-breakpoint
ALTER TABLE `Todo` ADD `isRecurring` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `Todo` ADD `recurrencePattern` text;--> statement-breakpoint
ALTER TABLE `Todo` ADD `recurrenceInterval` integer;--> statement-breakpoint
ALTER TABLE `Todo` ADD `recurrenceEndDate` text;--> statement-breakpoint
ALTER TABLE `Todo` ADD `recurrenceCount` integer;--> statement-breakpoint
ALTER TABLE `Todo` ADD `workDateOffset` integer;--> statement-breakpoint
ALTER TABLE `Todo` ADD `recurrenceGroupId` text;