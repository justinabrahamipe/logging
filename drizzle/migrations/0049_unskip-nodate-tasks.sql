-- Fix: un-skip no-date tasks that were wrongly auto-skipped
UPDATE Task SET skipped = 0 WHERE date = '' AND skipped = 1 AND completed = 0;
