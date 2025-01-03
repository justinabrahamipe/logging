/*
  Warnings:

  - You are about to drop the column `activityName` on the `Log` table. All the data in the column will be lost.
  - Added the required column `activityId` to the `Log` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Log" DROP CONSTRAINT "Log_activityName_fkey";

-- AlterTable
ALTER TABLE "Log" DROP COLUMN "activityName",
ADD COLUMN     "activityId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
