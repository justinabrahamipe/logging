"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { FaCheck, FaPlus, FaMinus, FaPlay, FaStop } from "react-icons/fa";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface TaskCompletion {
  id: number;
  taskId: number;
  completed: boolean;
  value: number | null;
  pointsEarned: number;
}

interface TaskWithCompletion {
  id: number;
  pillarId: number;
  name: string;
  completionType: string;
  target: number | null;
  unit: string | null;
  importance: string;
  basePoints: number;
  completion: TaskCompletion | null;
}

interface PillarGroup {
  pillar: {
    id: number;
    name: string;
    emoji: string;
    color: string;
  };
  tasks: TaskWithCompletion[];
}

interface ScoreSummary {
  actionScore: number;
  scoreTier: string;
  completedTasks: number;
  totalTasks: number;
}

function getImportanceBadge(importance: string) {
  switch (importance) {
    case 'high': return { label: 'High', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
    case 'medium': return { label: 'Med', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' };
    case 'low': return { label: 'Low', className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' };
    default: return { label: '', className: '' };
  }
}

export default function TodayPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [groups, setGroups] = useState<PillarGroup[]>([]);
  const [scoreSummary, setScoreSummary] = useState<ScoreSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [timers, setTimers] = useState<Record<number, { running: boolean; elapsed: number; interval?: NodeJS.Timeout }>>({});

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (session?.user?.id) {
      fetchTasks();
    }
  }, [session, status]);

  const fetchTasks = async () => {
    try {
      const res = await fetch(`/api/tasks?date=${today}`);
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
      }
      await fetchScore();
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchScore = async () => {
    try {
      const res = await fetch(`/api/daily-score?date=${today}`);
      if (res.ok) {
        const data = await res.json();
        setScoreSummary({
          actionScore: data.actionScore,
          scoreTier: data.scoreTier,
          completedTasks: data.completedTasks,
          totalTasks: data.totalTasks,
        });
      }
    } catch (error) {
      console.error("Failed to fetch score:", error);
    }
  };

  const handleComplete = useCallback(async (taskId: number, completed?: boolean, value?: number) => {
    try {
      const body: Record<string, unknown> = { taskId, date: today };
      if (completed !== undefined) body.completed = completed;
      if (value !== undefined) body.value = value;

      const res = await fetch('/api/tasks/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const completion = await res.json();
        // Update local state
        setGroups(prev => prev.map(g => ({
          ...g,
          tasks: g.tasks.map(t =>
            t.id === taskId ? { ...t, completion } : t
          ),
        })));
        // Refetch score
        await fetchScore();
      }
    } catch (error) {
      console.error("Failed to complete task:", error);
    }
  }, [today]);

  const handleCheckboxToggle = (task: TaskWithCompletion) => {
    const isCurrentlyCompleted = task.completion?.completed || false;
    handleComplete(task.id, !isCurrentlyCompleted, !isCurrentlyCompleted ? 1 : 0);
  };

  const handleCountChange = (task: TaskWithCompletion, delta: number) => {
    const current = task.completion?.value || 0;
    const newValue = Math.max(0, current + delta);
    handleComplete(task.id, newValue > 0, newValue);
  };

  const handleNumericChange = (task: TaskWithCompletion, value: string) => {
    const numValue = parseFloat(value) || 0;
    handleComplete(task.id, numValue > 0, numValue);
  };

  const handlePercentageChange = (task: TaskWithCompletion, value: string) => {
    const numValue = Math.min(100, Math.max(0, parseInt(value) || 0));
    handleComplete(task.id, numValue > 0, numValue);
  };

  const handleTimerToggle = (task: TaskWithCompletion) => {
    const timer = timers[task.id];
    if (timer?.running) {
      // Stop timer
      clearInterval(timer.interval);
      const minutes = Math.round(timer.elapsed / 60);
      handleComplete(task.id, minutes > 0, minutes);
      setTimers(prev => ({ ...prev, [task.id]: { running: false, elapsed: timer.elapsed } }));
    } else {
      // Start timer
      const startElapsed = timer?.elapsed || (task.completion?.value ? (task.completion.value) * 60 : 0);
      const interval = setInterval(() => {
        setTimers(prev => {
          const current = prev[task.id];
          if (!current?.running) return prev;
          return { ...prev, [task.id]: { ...current, elapsed: current.elapsed + 1 } };
        });
      }, 1000);
      setTimers(prev => ({ ...prev, [task.id]: { running: true, elapsed: startElapsed, interval } }));
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      Object.values(timers).forEach(t => {
        if (t.interval) clearInterval(t.interval);
      });
    };
  }, []);

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
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
            Today
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Score Summary Bar */}
        {scoreSummary && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {scoreSummary.actionScore}%
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {scoreSummary.scoreTier}
                </span>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {scoreSummary.completedTasks}/{scoreSummary.totalTasks} tasks
              </span>
            </div>
            <div className="mt-2 w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(scoreSummary.actionScore, 100)}%` }}
                transition={{ duration: 0.5 }}
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
              />
            </div>
          </div>
        )}

        {/* Task Groups */}
        {groups.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="text-lg mb-2">No tasks for today</p>
            <p className="text-sm">Set up your pillars and tasks to get started</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.pillar.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Pillar Header */}
                <div
                  className="px-4 py-3 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700"
                  style={{ borderLeftWidth: 4, borderLeftColor: group.pillar.color }}
                >
                  <span className="text-lg">{group.pillar.emoji}</span>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{group.pillar.name}</h3>
                </div>

                {/* Tasks */}
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {group.tasks.map((task) => {
                    const badge = getImportanceBadge(task.importance);
                    const isCompleted = task.completion?.completed || false;
                    const currentValue = task.completion?.value || 0;

                    return (
                      <div
                        key={task.id}
                        className={`px-4 py-3 transition-colors ${isCompleted ? 'bg-green-50/50 dark:bg-green-900/10' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${isCompleted ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                                {task.name}
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${badge.className}`}>
                                {badge.label}
                              </span>
                            </div>
                            {task.target && task.completionType !== 'checkbox' && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                Target: {task.target} {task.unit || ''}
                              </span>
                            )}
                          </div>

                          {/* Completion UI based on type */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {task.completionType === 'checkbox' && (
                              <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleCheckboxToggle(task)}
                                className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-colors ${
                                  isCompleted
                                    ? 'bg-green-500 border-green-500 text-white'
                                    : 'border-gray-300 dark:border-gray-600 hover:border-green-500'
                                }`}
                              >
                                {isCompleted && <FaCheck className="text-sm" />}
                              </motion.button>
                            )}

                            {task.completionType === 'count' && (
                              <div className="flex items-center gap-1">
                                <motion.button
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleCountChange(task, -1)}
                                  className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600"
                                >
                                  <FaMinus className="text-xs" />
                                </motion.button>
                                <span className={`w-12 text-center text-sm font-bold ${
                                  task.target && currentValue >= task.target ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'
                                }`}>
                                  {currentValue}/{task.target || '?'}
                                </span>
                                <motion.button
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleCountChange(task, 1)}
                                  className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600"
                                >
                                  <FaPlus className="text-xs" />
                                </motion.button>
                              </div>
                            )}

                            {task.completionType === 'duration' && (
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-mono text-gray-700 dark:text-gray-300 w-14 text-center">
                                  {timers[task.id]?.running
                                    ? formatTime(timers[task.id].elapsed)
                                    : `${currentValue || 0}m`
                                  }
                                </span>
                                <motion.button
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleTimerToggle(task)}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                    timers[task.id]?.running
                                      ? 'bg-red-500 text-white'
                                      : 'bg-blue-500 text-white'
                                  }`}
                                >
                                  {timers[task.id]?.running ? <FaStop className="text-xs" /> : <FaPlay className="text-xs" />}
                                </motion.button>
                              </div>
                            )}

                            {task.completionType === 'numeric' && (
                              <input
                                type="number"
                                value={currentValue || ''}
                                onChange={(e) => handleNumericChange(task, e.target.value)}
                                placeholder={task.target ? String(task.target) : '0'}
                                className="w-20 px-2 py-1 text-sm text-right border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                            )}

                            {task.completionType === 'percentage' && (
                              <div className="flex items-center gap-2">
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={currentValue || 0}
                                  onChange={(e) => handlePercentageChange(task, e.target.value)}
                                  className="w-20"
                                />
                                <span className="text-sm font-bold text-gray-900 dark:text-white w-10 text-right">
                                  {currentValue || 0}%
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
