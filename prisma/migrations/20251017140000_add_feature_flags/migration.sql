-- AlterTable (idempotent - only add if column doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='UserPreferences' AND column_name='enableTodo') THEN
        ALTER TABLE "UserPreferences" ADD COLUMN "enableTodo" BOOLEAN NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='UserPreferences' AND column_name='enableGoals') THEN
        ALTER TABLE "UserPreferences" ADD COLUMN "enableGoals" BOOLEAN NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='UserPreferences' AND column_name='enablePeople') THEN
        ALTER TABLE "UserPreferences" ADD COLUMN "enablePeople" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;
