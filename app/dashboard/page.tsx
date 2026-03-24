"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { useDashboard } from "./hooks/useDashboard";
import ScoreCard from "./components/ScoreCard";
import MorningBriefing from "./components/MorningBriefing";
import GoalProgress from "./components/GoalProgress";
import HabitTracker from "./components/HabitTracker";
import StreakFlameChain from "./components/StreakFlameChain";
import CalendarHeatmap from "./components/CalendarHeatmap";
import ScoreHistory from "./components/ScoreHistory";
import CyclePerformance from "./components/CyclePerformance";
import DashboardLoading from "./loading";

export default function DashboardPage() {
  const {
    score,
    history,
    outcomesData,
    completionDates,
    momentumData,
    loading,
    todayTaskCount,
    today,
    currentStreak,
    dateFormat,
  } = useDashboard();

  if (loading) return <DashboardLoading />;

  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-[1800px]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white">
              Dashboard
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {formatDate(new Date().toISOString().split('T')[0], dateFormat)}
            </p>
          </div>
          <Link href="/tasks">
            <button className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg font-medium">
              Go to Tasks
            </button>
          </Link>
        </div>

        {/* Responsive grid: 1 col mobile, 2 col desktop, 3 col ultrawide */}
        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
          {/* Column 1 */}
          <div>
            {history && (
              <MorningBriefing
                history={history}
                currentStreak={currentStreak}
                todayTaskCount={todayTaskCount}
              />
            )}

            <ScoreCard score={score} momentumData={momentumData} />

            <GoalProgress outcomesData={outcomesData} completionDates={completionDates} today={today} />

            <CyclePerformance />

            {history && <CalendarHeatmap scores={history.scores} />}
          </div>

          {/* Column 2 */}
          <div>
            <HabitTracker outcomesData={outcomesData} completionDates={completionDates} today={today} />

            {history && <StreakFlameChain scores={history.scores} currentStreak={currentStreak} />}

            {history && <ScoreHistory scores={history.scores} />}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
