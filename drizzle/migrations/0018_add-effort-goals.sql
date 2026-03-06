ALTER TABLE `Outcome` ADD `goalType` text NOT NULL DEFAULT 'outcome';
--> statement-breakpoint
ALTER TABLE `Outcome` ADD `scheduleDays` text;
--> statement-breakpoint
ALTER TABLE `Outcome` ADD `autoCreateTasks` integer NOT NULL DEFAULT 0;
