CREATE INDEX IF NOT EXISTS Task_userId_date_completed_skipped_idx ON Task(userId, date, completed, skipped);
