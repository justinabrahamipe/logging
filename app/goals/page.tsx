"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FaPlus } from "react-icons/fa";
import { useGoals } from "./hooks/useGoals";
import { Outcome } from "./types";
import GoalCard from "./components/GoalCard";
import LogModal from "./components/LogModal";

export default function GoalsPage() {
  const router = useRouter();
  const {
    allOutcomes,
    loading,
    menuOpen,
    setMenuOpen,
    logsMap,
    goalTab,
    setGoalTab,
    timeTab,
    setTimeTab,
    linkedTasks,
    taskCompletionDates,
    filteredOutcomes,
    timeCounts,
    today,
    handleArchive,
    handleAddTaskForToday,
    getProgress,
    fetchOutcomes,
  } = useGoals();

  const [logTarget, setLogTarget] = useState<Outcome | null>(null);

  const openLogModal = (outcome: Outcome) => {
    setLogTarget(outcome);
    setMenuOpen(null);
  };

  const handleLogSave = async (value: number, note: string | null, logDate: string | null) => {
    if (!logTarget) return;
    try {
      const res = await fetch(`/api/outcomes/${logTarget.id}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value, note, loggedAt: logDate }),
      });
      if (res.ok) await fetchOutcomes();
    } catch (error) {
      console.error("Failed to log progress:", error);
    }
    setLogTarget(null);
  };

  // Group filtered outcomes by pillar
  const grouped: Record<string, Outcome[]> = {};
  for (const o of filteredOutcomes) {
    const key = o.pillarId ? `${o.pillarId}` : "none";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(o);
  }

  const groupKeys = Object.keys(grouped).sort((a, b) => {
    if (a === "none") return 1;
    if (b === "none") return -1;
    return 0;
  });

  const getPillarInfo = (key: string) => {
    if (key === "none") return { name: "No Pillar", emoji: "", color: "#6B7280" };
    const outcome = grouped[key][0];
    return {
      name: outcome.pillarName || "Unknown",
      emoji: outcome.pillarEmoji || "",
      color: outcome.pillarColor || "#6B7280",
    };
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
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">Goals</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Track effort-based and outcome-based goals</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push("/goals/new")}
            className="p-2 md:px-4 md:py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium flex items-center gap-2"
          >
            <FaPlus /> <span className="hidden md:inline">Add Goal</span>
          </motion.button>
        </div>

        {/* Goal Type Tabs + Time Tabs */}
        <div className="flex items-center justify-between mb-6 gap-2">
          <div className="hidden md:flex gap-2">
            {([
              { key: "habitual" as const, label: "Habitual" },
              { key: "target" as const, label: "Target" },
              { key: "outcome" as const, label: "Outcome" },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setGoalTab(key)}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  goalTab === key
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <select
            value={goalTab}
            onChange={(e) => setGoalTab(e.target.value as "habitual" | "target" | "outcome")}
            className="md:hidden px-3 py-2 text-sm font-semibold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="habitual">Habitual</option>
            <option value="target">Target</option>
            <option value="outcome">Outcome</option>
          </select>

          <div className="hidden md:flex gap-2">
            {([
              { key: "current" as const, label: "Current" },
              { key: "future" as const, label: "Future" },
              { key: "past" as const, label: "Past" },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTimeTab(key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  timeTab === key
                    ? "bg-gray-700 dark:bg-gray-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {label} {timeCounts[key] > 0 && <span className="ml-1 opacity-70">({timeCounts[key]})</span>}
              </button>
            ))}
          </div>
          <select
            value={timeTab}
            onChange={(e) => setTimeTab(e.target.value as "current" | "future" | "past")}
            className="md:hidden px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="current">Current {timeCounts.current > 0 ? `(${timeCounts.current})` : ''}</option>
            <option value="future">Future {timeCounts.future > 0 ? `(${timeCounts.future})` : ''}</option>
            <option value="past">Past {timeCounts.past > 0 ? `(${timeCounts.past})` : ''}</option>
          </select>
        </div>

        {/* Goal Cards */}
        {groupKeys.length > 0 ? (
          groupKeys.map((key) => {
            const pillarInfo = getPillarInfo(key);
            return (
              <div key={key} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  {pillarInfo.emoji && <span className="text-lg">{pillarInfo.emoji}</span>}
                  <h2 className="text-lg font-semibold" style={{ color: pillarInfo.color }}>
                    {pillarInfo.name}
                  </h2>
                </div>
                <div className="space-y-3">
                  {grouped[key].map((outcome) => (
                    <GoalCard
                      key={outcome.id}
                      outcome={outcome}
                      logsMap={logsMap}
                      linkedTasks={linkedTasks}
                      menuOpen={menuOpen}
                      setMenuOpen={setMenuOpen}
                      openLogModal={openLogModal}
                      handleArchive={handleArchive}
                      getProgress={getProgress}
                      today={today}
                      taskCompletionDates={taskCompletionDates}
                      onAddTask={handleAddTaskForToday}
                    />
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="text-lg mb-2">No {timeTab} {goalTab} goals</p>
            <p className="text-sm">
              {timeTab === "current" && `Create a ${goalTab} goal to see it here`}
              {timeTab === "future" && "Goals with a future start date will appear here"}
              {timeTab === "past" && "Goals whose target date has passed will appear here"}
            </p>
          </div>
        )}

        {/* Log Modal */}
        <AnimatePresence>
          {logTarget && (
            <LogModal
              logTarget={logTarget}
              onClose={() => setLogTarget(null)}
              onSave={handleLogSave}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
