ALTER TABLE Task ADD COLUMN dismissed integer NOT NULL DEFAULT 0;

-- Recalculate isPassing for all historical scores using the new 95% threshold
UPDATE DailyScore SET isPassing = (actionScore >= 95);

-- Contact messages table
CREATE TABLE IF NOT EXISTS ContactMessage (
  id integer PRIMARY KEY AUTOINCREMENT,
  userId text NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  topic text NOT NULL DEFAULT 'General Feedback',
  message text NOT NULL,
  read integer NOT NULL DEFAULT 0,
  createdAt integer NOT NULL DEFAULT (unixepoch())
);
