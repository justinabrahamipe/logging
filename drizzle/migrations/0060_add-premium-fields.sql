ALTER TABLE `UserPreferences` ADD `isPremium` integer NOT NULL DEFAULT false;
ALTER TABLE `UserPreferences` ADD `premiumActivatedAt` integer;
ALTER TABLE `UserPreferences` ADD `promoCode` text;
