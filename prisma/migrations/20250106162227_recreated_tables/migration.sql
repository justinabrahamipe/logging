-- DropForeignKey
ALTER TABLE "Log" DROP CONSTRAINT "Log_activityTitle_activityCategory_activityIcon_fkey";

-- DropIndex
DROP INDEX "Activity_title_category_icon_key";
