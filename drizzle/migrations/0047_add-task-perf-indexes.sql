-- Optimize auto-skip and common task query patterns
CREATE INDEX IF NOT EXISTS Task_userId_date_completed_skipped_idx ON tasks(userId, date, completed, skipped);
CREATE INDEX IF NOT EXISTS Task_userId_dismissed_goalId_idx ON tasks(userId, dismissed, goalId);
