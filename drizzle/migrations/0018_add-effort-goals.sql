ALTER TABLE `Outcome` ADD `goalType` text NOT NULL DEFAULT 'outcome';
ALTER TABLE `Outcome` ADD `scheduleDays` text;
ALTER TABLE `Outcome` ADD `autoCreateTasks` integer NOT NULL DEFAULT 0;
