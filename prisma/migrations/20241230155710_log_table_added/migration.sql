-- CreateTable
CREATE TABLE "Log" (
    "id" SERIAL NOT NULL,
    "comment" TEXT NOT NULL,
    "activityName" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "created_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "time_spent" INTEGER NOT NULL,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_activityName_fkey" FOREIGN KEY ("activityName") REFERENCES "Activity"("name") ON DELETE RESTRICT ON UPDATE CASCADE;
