-- Recreate Task table with nullable pillarId (was NOT NULL from migration 0004)
-- SQLite does not support ALTER COLUMN, so we must recreate the table

PRAGMA foreign_keys=OFF;--> statement-breakpoint

CREATE TABLE `Task_new` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `pillarId` integer REFERENCES `Pillar`(`id`) ON DELETE SET NULL,
  `userId` text NOT NULL,
  `name` text NOT NULL,
  `completionType` text DEFAULT 'checkbox' NOT NULL,
  `target` real,
  `unit` text,
  `flexibilityRule` text DEFAULT 'must_today' NOT NULL,
  `windowStart` integer,
  `windowEnd` integer,
  `limitValue` real,
  `importance` text DEFAULT 'medium' NOT NULL,
  `frequency` text DEFAULT 'daily' NOT NULL,
  `customDays` text,
  `isWeekendTask` integer DEFAULT false NOT NULL,
  `basePoints` real DEFAULT 10 NOT NULL,
  `outcomeId` integer REFERENCES `Outcome`(`id`) ON DELETE SET NULL,
  `periodId` integer REFERENCES `TwelveWeekYear`(`id`) ON DELETE SET NULL,
  `isActive` integer DEFAULT true NOT NULL,
  `createdAt` integer DEFAULT (unixepoch()) NOT NULL,
  `updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);--> statement-breakpoint

INSERT INTO `Task_new` SELECT * FROM `Task`;--> statement-breakpoint

DROP TABLE `Task`;--> statement-breakpoint

ALTER TABLE `Task_new` RENAME TO `Task`;--> statement-breakpoint

CREATE INDEX `Task_userId_idx` ON `Task` (`userId`);--> statement-breakpoint
CREATE INDEX `Task_pillarId_idx` ON `Task` (`pillarId`);--> statement-breakpoint
CREATE INDEX `Task_outcomeId_idx` ON `Task` (`outcomeId`);--> statement-breakpoint
CREATE INDEX `Task_periodId_idx` ON `Task` (`periodId`);--> statement-breakpoint

PRAGMA foreign_keys=ON;
