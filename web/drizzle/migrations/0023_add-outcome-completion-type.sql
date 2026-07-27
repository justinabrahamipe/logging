ALTER TABLE `Outcome` ADD `completionType` text NOT NULL DEFAULT 'checkbox';
--> statement-breakpoint
ALTER TABLE `Outcome` ADD `dailyTarget` real;
