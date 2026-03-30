"use client";

import { motion } from "framer-motion";
import type { DailyScoreData, MomentumData } from "@/lib/types";
import { getTierColor } from "./utils";

interface ScoreCardProps {
  score: DailyScoreData | null;
  momentumData: MomentumData | null;
}

export default function ScoreCard({ score, momentumData }: ScoreCardProps) {
  const mVal = momentumData?.overall ?? 0;
  const mPct = Math.min(mVal / 2, 1);
  const mColor = mVal >= 1.0 ? "#22C55E" : "#EF4444";
  const mLabel = mVal >= 1.05 ? "Ahead" : mVal >= 0.95 ? "On track" : "Behind";

  const tVal = momentumData?.trajectory?.overall ?? 0;
  const tPct = Math.max(0, Math.min(tVal / 2, 1));
  const tColor = tVal >= 1.0 ? "#A855F7" : "#EF4444";
  const tLabel = tVal >= 1.05 ? "Ahead" : tVal >= 0.95 ? "On track" : "Behind";

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {/* Action Score */}
      <div title="Action Score: % of today's tasks completed. Higher = more productive day." className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 flex flex-col items-center justify-center text-center cursor-help">
        <div className="relative w-20 h-20 md:w-24 md:h-24">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-zinc-200 dark:text-zinc-700" />
            <motion.circle
              cx="50" cy="50" r="42" fill="none"
              strokeWidth="8" strokeLinecap="round"
              stroke={score ? getTierColor(score.scoreTier) : "#6B7280"}
              strokeDasharray={2 * Math.PI * 42}
              initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - Math.min((score?.actionScore || 0) / 100, 1)) }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg md:text-xl font-bold text-zinc-900 dark:text-white leading-none">
              {score ? `${score.actionScore}%` : "\u2014"}
            </span>
          </div>
        </div>
        <div className="text-[10px] md:text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-2">Action Score</div>
        {score && (
          <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
            {score.completedTasks}/{score.totalTasks} tasks
          </div>
        )}
      </div>

      {/* Momentum */}
      <div title="Momentum: Are your target goals on pace? 1.0x = on pace, above = ahead, below = behind." className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 flex flex-col items-center justify-center text-center cursor-help">
        <div className="relative w-20 h-20 md:w-24 md:h-24">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-zinc-200 dark:text-zinc-700" />
            <motion.circle
              cx="50" cy="50" r="42" fill="none"
              strokeWidth="8" strokeLinecap="round"
              stroke={mColor}
              strokeDasharray={2 * Math.PI * 42}
              initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - mPct) }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg md:text-xl font-bold leading-none" style={{ color: momentumData && momentumData.goals.length > 0 ? mColor : '#9CA3AF' }}>
              {momentumData && momentumData.goals.length > 0 ? `${mVal.toFixed(1)}x` : "\u2014"}
            </span>
          </div>
        </div>
        <div className="text-[10px] md:text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-2">Momentum</div>
        {momentumData && momentumData.goals.length > 0 ? (
          <div className="text-[10px] text-zinc-400 dark:text-zinc-500">{mLabel}</div>
        ) : (
          <div className="text-[10px] text-zinc-400 dark:text-zinc-500">No target goals</div>
        )}
      </div>

      {/* Trajectory */}
      <div title="Trajectory: Are your outcome goals trending in the right direction? 1.0x = on pace, above = ahead, below = behind." className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 flex flex-col items-center justify-center text-center cursor-help">
        <div className="relative w-20 h-20 md:w-24 md:h-24">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-zinc-200 dark:text-zinc-700" />
            <motion.circle
              cx="50" cy="50" r="42" fill="none"
              strokeWidth="8" strokeLinecap="round"
              stroke={tColor}
              strokeDasharray={2 * Math.PI * 42}
              initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - tPct) }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg md:text-xl font-bold leading-none" style={{ color: momentumData?.trajectory && momentumData.trajectory.goals.length > 0 ? tColor : '#9CA3AF' }}>
              {momentumData?.trajectory && momentumData.trajectory.goals.length > 0 ? `${tVal.toFixed(1)}x` : "\u2014"}
            </span>
          </div>
        </div>
        <div className="text-[10px] md:text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-2">Trajectory</div>
        {momentumData?.trajectory && momentumData.trajectory.goals.length > 0 ? (
          <div className="text-[10px] text-zinc-400 dark:text-zinc-500">{tLabel}</div>
        ) : (
          <div className="text-[10px] text-zinc-400 dark:text-zinc-500">No outcome goals</div>
        )}
      </div>
    </div>
  );
}
