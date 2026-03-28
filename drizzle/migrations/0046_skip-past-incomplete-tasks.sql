-- One-time: mark all past incomplete tasks as skipped
UPDATE tasks
SET skipped = 1
WHERE completed = 0
  AND skipped = 0
  AND dismissed = 0
  AND date < date('now');
