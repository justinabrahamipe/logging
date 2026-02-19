ALTER TABLE `Outcome` ADD COLUMN `periodId` integer REFERENCES `TwelveWeekYear`(`id`) ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX `Outcome_periodId_idx` ON `Outcome` (`periodId`);
