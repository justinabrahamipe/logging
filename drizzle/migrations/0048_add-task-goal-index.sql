CREATE INDEX IF NOT EXISTS Task_userId_dismissed_goalId_idx ON Task(userId, dismissed, goalId);
