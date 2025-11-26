DROP TABLE `IgnoredContact`;--> statement-breakpoint
ALTER TABLE `Contact` ADD `isIgnored` integer DEFAULT false NOT NULL;