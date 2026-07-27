ALTER TABLE `Outcome` ADD `linkedOutcomeId` integer REFERENCES `Outcome`(`id`) ON DELETE SET NULL;
