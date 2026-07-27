ALTER TABLE Task ADD COLUMN skipped integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE Task ADD COLUMN dismissed integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE DailyScore DROP COLUMN isPassing;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS ContactMessage (
  id integer PRIMARY KEY AUTOINCREMENT,
  userId text NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  topic text NOT NULL DEFAULT 'General Feedback',
  message text NOT NULL,
  read integer NOT NULL DEFAULT 0,
  createdAt integer NOT NULL DEFAULT (unixepoch())
);
