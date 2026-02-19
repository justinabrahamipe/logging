ALTER TABLE `Task` ADD COLUMN `periodId` integer REFERENCES `TwelveWeekYear`(`id`) ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX `Task_periodId_idx` ON `Task` (`periodId`);
