"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { FaFire, FaStar, FaTrophy, FaBolt } from "react-icons/fa";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface PillarScore {
  id: number;
  name: string;
  emoji: string;
  color: string;
  weight: number;
  score: number;
}

interface DailyScoreData {
  date: string;
  actionScore: number;
  scoreTier: string;
  pillarScores: PillarScore[];
  totalTasks: number;
  completedTasks: number;
}

interface UserStatsData {
  totalXp: number;
  level: number;
  levelTitle: string;
  currentStreak: number;
  bestStreak: number;
  levelInfo: {
    level: number;
    title: string;
    currentXp: number;
    xpForNextLevel: number;
    xpProgress: number;
  };
}

function getTierColor(tier: string): string {
  switch (tier) {
    case 'LEGENDARY': return '#FFD700';
    case 'Excellent': return '#22C55E';
    case 'Good': return '#3B82F6';
    case 'Decent': return '#F59E0B';
    case 'Needs Work': return '#F97316';
    case 'Poor': return '#EF4444';
    default: return '#6B7280';
  }
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [score, setScore] = useState<DailyScoreData | null>(null);
  const [stats, setStats] = useState<UserStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const seedingRef = useRef(false);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (session?.user?.id) {
      fetchData();
    }
  }, [session, status]);

  const fetchData = async () => {
    try {
      const [scoreRes, statsRes] = await Promise.all([
        fetch(`/api/daily-score?date=${today}`),
        fetch('/api/user-stats'),
      ]);

      if (scoreRes.ok) {
        const scoreData = await scoreRes.json();
        setScore(scoreData);
      }

      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    if (seedingRef.current) return;
    seedingRef.current = true;
    setSeeding(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      if (res.ok) {
        // Refetch data
        const [scoreRes, statsRes] = await Promise.all([
          fetch(`/api/daily-score?date=${today}`),
          fetch('/api/user-stats'),
        ]);
        if (scoreRes.ok) setScore(await scoreRes.json());
        if (statsRes.ok) setStats(await statsRes.json());
      }
    } catch (error) {
      console.error("Failed to seed:", error);
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
              Dashboard
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <Link href="/today">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium"
            >
              Go to Today
            </motion.button>
          </Link>
        </div>

        {/* Empty State — Seed Prompt */}
        {score && score.totalTasks === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 mb-6 text-center">
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
              No pillars or tasks yet. Set up your default data to get started.
            </p>
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {seeding ? 'Setting up...' : 'Load Default Data'}
            </button>
          </div>
        )}

        {/* Action Score */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FaBolt className="text-2xl text-yellow-500" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Action Score</h2>
            </div>
            {score && (
              <span
                className="px-3 py-1 rounded-full text-sm font-bold"
                style={{ backgroundColor: getTierColor(score.scoreTier) + '20', color: getTierColor(score.scoreTier) }}
              >
                {score.scoreTier}
              </span>
            )}
          </div>

          {score && (
            <>
              <div className="relative w-full h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(score.actionScore, 100)}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: getTierColor(score.scoreTier) }}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {score.completedTasks}/{score.totalTasks} tasks
                </span>
                <span className="font-bold text-gray-900 dark:text-white text-lg">
                  {score.actionScore}%
                </span>
              </div>
            </>
          )}
        </div>

        {/* Pillar Breakdown */}
        {score && score.pillarScores.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Pillar Breakdown</h2>
            <div className="space-y-4">
              {score.pillarScores.map((pillar) => (
                <div key={pillar.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span>{pillar.emoji}</span>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{pillar.name}</span>
                      <span className="text-xs text-gray-500">({pillar.weight}%)</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{pillar.score}%</span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(pillar.score, 100)}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: pillar.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* XP & Level + Streak */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* XP & Level */}
          {stats && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-2 mb-4">
                <FaTrophy className="text-2xl text-purple-500" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Level</h2>
              </div>
              <div className="text-center mb-4">
                <div className="text-4xl font-bold text-purple-600 dark:text-purple-400">
                  {stats.levelInfo.level}
                </div>
                <div className="text-lg text-gray-600 dark:text-gray-400">
                  {stats.levelInfo.title}
                </div>
              </div>
              <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.levelInfo.xpProgress}%` }}
                  transition={{ duration: 0.8 }}
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                />
              </div>
              <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                {stats.levelInfo.currentXp} / {stats.levelInfo.xpForNextLevel} XP to next level
              </p>
            </div>
          )}

          {/* Streak */}
          {stats && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-2 mb-4">
                <FaFire className="text-2xl text-orange-500" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Streak</h2>
              </div>
              <div className="text-center">
                <div className="text-5xl font-bold text-orange-500 mb-2">
                  {stats.currentStreak}
                </div>
                <div className="text-lg text-gray-600 dark:text-gray-400">
                  {stats.currentStreak === 1 ? 'day' : 'days'} in a row
                </div>
                <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                  <FaStar className="inline mr-1 text-yellow-500" />
                  Best: {stats.bestStreak} days
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
