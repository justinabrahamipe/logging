ALTER TABLE `Task` ADD COLUMN `outcomeId` integer REFERENCES `Outcome`(`id`) ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `Task_outcomeId_idx` ON `Task` (`outcomeId`);
