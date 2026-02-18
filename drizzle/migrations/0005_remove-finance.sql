-- Drop finance tables
DROP TABLE IF EXISTS `FinanceTransaction`;--> statement-breakpoint
DROP TABLE IF EXISTS `FinanceAccount`;--> statement-breakpoint
DROP TABLE IF EXISTS `FinanceCategory`;--> statement-breakpoint
DROP TABLE IF EXISTS `FinanceDebt`;--> statement-breakpoint

-- Drop enableFinance column from UserPreferences
ALTER TABLE `UserPreferences` DROP COLUMN `enableFinance`;
