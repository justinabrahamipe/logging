-- CreateTable
CREATE TABLE "Activity" (
    "id" SERIAL NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '--',
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "created_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Log" (
    "id" SERIAL NOT NULL,
    "comment" TEXT,
    "activityTitle" TEXT NOT NULL,
    "activityCategory" TEXT NOT NULL,
    "activityIcon" TEXT NOT NULL,
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "created_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "time_spent" INTEGER,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Todo" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "activityTitle" TEXT,
    "activityCategory" TEXT,
    "deadline" TEXT,
    "work_date" TEXT,
    "importance" INTEGER NOT NULL DEFAULT 1,
    "urgency" INTEGER NOT NULL DEFAULT 1,
    "created_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Todo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Activity_title_key" ON "Activity" ("title");
