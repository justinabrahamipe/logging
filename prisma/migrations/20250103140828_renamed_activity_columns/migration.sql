/*
  Warnings:

  - You are about to drop the column `name` on the `Activity` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Activity` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[title]` on the table `Activity` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `category` to the `Activity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Activity` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Activity_name_key";

-- AlterTable
ALTER TABLE "Activity" DROP COLUMN "name",
DROP COLUMN "type",
ADD COLUMN     "category" TEXT NOT NULL,
ADD COLUMN     "title" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Activity_title_key" ON "Activity"("title");
