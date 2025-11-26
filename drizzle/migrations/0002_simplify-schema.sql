DROP TABLE `FinanceTransactionContact`;--> statement-breakpoint
DROP TABLE `FinanceTransactionPlace`;--> statement-breakpoint
DROP TABLE `GoalContact`;--> statement-breakpoint
DROP TABLE `GoalPlace`;--> statement-breakpoint
DROP TABLE `LogContact`;--> statement-breakpoint
DROP TABLE `LogPlace`;--> statement-breakpoint
DROP TABLE `PlaceContact`;--> statement-breakpoint
DROP TABLE `TodoContact`;--> statement-breakpoint
DROP TABLE `TodoGoal`;--> statement-breakpoint
DROP TABLE `TodoPlace`;--> statement-breakpoint
ALTER TABLE `FinanceTransaction` ADD `placeId` integer;--> statement-breakpoint
ALTER TABLE `FinanceTransaction` ADD `contactIds` text;--> statement-breakpoint
CREATE INDEX `FinanceTransaction_placeId_idx` ON `FinanceTransaction` (`placeId`);--> statement-breakpoint
ALTER TABLE `Goal` ADD `placeId` integer;--> statement-breakpoint
ALTER TABLE `Goal` ADD `contactIds` text;--> statement-breakpoint
CREATE INDEX `Goal_placeId_idx` ON `Goal` (`placeId`);--> statement-breakpoint
ALTER TABLE `Log` ADD `placeId` integer;--> statement-breakpoint
ALTER TABLE `Log` ADD `contactIds` text;--> statement-breakpoint
CREATE INDEX `Log_placeId_idx` ON `Log` (`placeId`);--> statement-breakpoint
ALTER TABLE `Todo` ADD `placeId` integer;--> statement-breakpoint
ALTER TABLE `Todo` ADD `contactIds` text;--> statement-breakpoint
ALTER TABLE `Todo` ADD `goalId` integer;--> statement-breakpoint
CREATE INDEX `Todo_placeId_idx` ON `Todo` (`placeId`);--> statement-breakpoint
CREATE INDEX `Todo_goalId_idx` ON `Todo` (`goalId`);