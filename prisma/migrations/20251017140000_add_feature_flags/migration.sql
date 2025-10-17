-- AlterTable
ALTER TABLE "UserPreferences" ADD COLUMN "enableTodo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UserPreferences" ADD COLUMN "enableGoals" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UserPreferences" ADD COLUMN "enablePeople" BOOLEAN NOT NULL DEFAULT false;
