CREATE INDEX IF NOT EXISTS "Task_userId_goalId_completed_idx" ON "Task" ("userId", "goalId", "completed");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Task_userId_scheduleId_idx" ON "Task" ("userId", "scheduleId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Task_goalId_completed_value_idx" ON "Task" ("goalId", "completed", "value");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ActivityLog_userId_timestamp_idx" ON "ActivityLog" ("userId", "timestamp");
