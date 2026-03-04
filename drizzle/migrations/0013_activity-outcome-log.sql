ALTER TABLE `ActivityLog` ADD COLUMN `outcomeLogId` integer REFERENCES `OutcomeLog`(`id`) ON DELETE SET NULL;
