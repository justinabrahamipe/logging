/*
  Warnings:

  - You are about to drop the column `activityId` on the `Log` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[title,category,icon]` on the table `Activity` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `activityCategory` to the `Log` table without a default value. This is not possible if the table is not empty.
  - Added the required column `activityIcon` to the `Log` table without a default value. This is not possible if the table is not empty.
  - Added the required column `activityTitle` to the `Log` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Log" DROP CONSTRAINT "Log_activityId_fkey";

-- AlterTable
ALTER TABLE "Log" DROP COLUMN "activityId",
ADD COLUMN     "activityCategory" TEXT NOT NULL,
ADD COLUMN     "activityIcon" TEXT NOT NULL,
ADD COLUMN     "activityTitle" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Activity_title_category_icon_key" ON "Activity"("title", "category", "icon");

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_activityTitle_activityCategory_activityIcon_fkey" FOREIGN KEY ("activityTitle", "activityCategory", "activityIcon") REFERENCES "Activity"("title", "category", "icon") ON DELETE RESTRICT ON UPDATE CASCADE;
