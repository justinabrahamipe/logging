ALTER TABLE Task ADD COLUMN originalDate text;
--> statement-breakpoint
UPDATE Task SET originalDate = date WHERE originalDate IS NULL;