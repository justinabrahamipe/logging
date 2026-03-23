ALTER TABLE Task ADD COLUMN dismissed integer NOT NULL DEFAULT 0;

-- Recalculate isPassing for all historical scores using the new 95% threshold
UPDATE DailyScore SET isPassing = (actionScore >= 95);
