"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPlus } from "react-icons/fa";
import { Snackbar, Alert as MuiAlert } from "@mui/material";
import { useGoals } from "./hooks/useGoals";
import { Outcome } from "./types";
import GoalCard from "./components/GoalCard";
import LogModal from "./components/LogModal";

export default function GoalsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [authSnackbar, setAuthSnackbar] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" | "info" }>({ open: false, message: "", severity: "info" });
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
    if (status !== "authenticated") { setAuthSnackbar(true); return; }
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
      if (res.ok) {
        // Only create an ad-hoc task if the outcome does NOT have autoCreateTasks enabled
        // (when autoCreateTasks is on, a recurring task already exists for this outcome)
        if (!logTarget.autoCreateTasks) {
          const taskRes = await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: `${logTarget.name}${note ? ` - ${note}` : ""}`,
              pillarId: logTarget.pillarId || null,
              completionType: logTarget.completionType || "numeric",
              target: value,
              unit: logTarget.unit || null,
              frequency: "adhoc",
              outcomeId: logTarget.id,
              basePoints: 10,
              startDate: logDate || today,
            }),
          });
          if (taskRes.ok) {
            const task = await taskRes.json();
            await fetch("/api/tasks/complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ taskId: task.id, date: logDate || today, completed: true, value }),
            });
          }
        }
        await fetchOutcomes();
        setSnackbar({ open: true, message: "Progress logged successfully", severity: "success" });
      } else {
        setSnackbar({ open: true, message: "Failed to log progress", severity: "error" });
      }
    } catch (error) {
      console.error("Failed to log progress:", error);
      setSnackbar({ open: true, message: "Failed to log progress", severity: "error" });
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 dark:border-white"></div>
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
            <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white">Goals</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Track effort-based and outcome-based goals</p>
          </div>
        </div>

        {/* Goal Type Tabs + Time Tabs */}
        <div className="flex items-center justify-between mb-6 gap-2">
          <div className="hidden md:flex gap-2">
            {([
              { key: "all" as const, label: "All" },
              { key: "habitual" as const, label: "Habitual" },
              { key: "target" as const, label: "Target" },
              { key: "outcome" as const, label: "Outcome" },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setGoalTab(key)}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  goalTab === key
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <select
            value={goalTab}
            onChange={(e) => setGoalTab(e.target.value as "all" | "habitual" | "target" | "outcome")}
            className="md:hidden px-3 py-2 text-sm font-semibold rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
          >
            <option value="all">All</option>
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
                    ? "bg-zinc-700 dark:bg-zinc-600 text-white"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {label} {timeCounts[key] > 0 && <span className="ml-1 opacity-70">({timeCounts[key]})</span>}
              </button>
            ))}
          </div>
          <select
            value={timeTab}
            onChange={(e) => setTimeTab(e.target.value as "current" | "future" | "past")}
            className="md:hidden px-3 py-2 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
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
                      onAddTask={async (o) => { if (status !== "authenticated") { setAuthSnackbar(true); return; } const ok = await handleAddTaskForToday(o); setSnackbar({ open: true, message: ok ? "Task added and completed" : "Failed to add task", severity: ok ? "success" : "error" }); }}
                      onQuickLog={openLogModal}
                    />
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
            <p className="text-lg mb-2">No {timeTab} {goalTab === "all" ? "" : goalTab + " "}goals</p>
            <p className="text-sm">
              {timeTab === "current" && (goalTab === "all" ? "Create a goal to see it here" : `Create a ${goalTab} goal to see it here`)}
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

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <MuiAlert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} variant="filled" sx={{ width: "100%" }}>
          {snackbar.message}
        </MuiAlert>
      </Snackbar>

      <Snackbar
        open={authSnackbar}
        autoHideDuration={3000}
        onClose={() => setAuthSnackbar(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <MuiAlert onClose={() => setAuthSnackbar(false)} severity="info" variant="filled" sx={{ width: "100%" }}>
          Sign in to track your goals
        </MuiAlert>
      </Snackbar>

      {/* Floating Add Goal button */}
      <button
        onClick={() => router.push("/goals/new")}
        className="fixed bottom-20 md:bottom-14 right-4 md:right-8 z-40 w-12 h-12 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-lg flex items-center justify-center hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
      >
        <FaPlus className="text-lg" />
      </button>
    </div>
  );
}
