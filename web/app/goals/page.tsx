"use client";

import { useState, useEffect, useCallback } from "react";
import { parseScheduleDays } from "@/lib/format";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPlus } from "react-icons/fa";
import { Snackbar, Alert as MuiAlert } from "@mui/material";
import { useGoals } from "./hooks/useGoals";
import { Outcome, Cycle } from "./types";
import GoalCard from "./components/GoalCard";
import LogModal from "./components/LogModal";
import GoalsLoading from "./loading";

export default function GoalsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [authSnackbar, setAuthSnackbar] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" | "info" }>({ open: false, message: "", severity: "info" });
  const {
    loading,
    menuOpen,
    setMenuOpen,
    logsMap,
    goalTab,
    setGoalTab,
    timeTab,
    setTimeTab,
    searchQuery,
    setSearchQuery,
    linkedTasks,
    taskCompletionDates,
    filteredGoals,
    timeCounts,
    today,
    handleArchive,
    handleStatusChange,
    handleAddTaskForToday,
    getProgress,
    fetchGoals,
    confirmDialog,
    setConfirmDialog,
  } = useGoals();

  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [logTarget, setLogTarget] = useState<Outcome | null>(null);

  const fetchCycles = useCallback(async () => {
    try {
      const res = await fetch("/api/cycles");
      if (res.ok) setCycles(await res.json());
    } catch {}
  }, []);

  useEffect(() => { fetchCycles(); }, [fetchCycles]);

  const handleCopyToCycle = async (outcome: Outcome, cycleId: number) => {
    if (status !== "authenticated") { setAuthSnackbar(true); return; }
    const cycle = cycles.find(c => c.id === cycleId);
    if (!cycle) return;
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: outcome.name,
          targetValue: outcome.targetValue,
          unit: outcome.unit,
          pillarId: outcome.pillarId,
          periodId: cycleId,
          goalType: outcome.goalType,
          completionType: outcome.completionType,
          dailyTarget: outcome.dailyTarget,
          scheduleDays: parseScheduleDays(outcome.scheduleDays),
          autoCreateTasks: outcome.autoCreateTasks,
          startValue: outcome.startValue,
          startDate: cycle.startDate,
          targetDate: cycle.endDate,
        }),
      });
      if (res.ok) {
        await fetchGoals();
        setSnackbar({ open: true, message: `Goal copied to ${cycle.name}`, severity: "success" });
      } else {
        setSnackbar({ open: true, message: "Failed to copy goal", severity: "error" });
      }
    } catch {
      setSnackbar({ open: true, message: "Failed to copy goal", severity: "error" });
    }
  };

  const openLogModal = (outcome: Outcome) => {
    if (status !== "authenticated") { setAuthSnackbar(true); return; }
    setLogTarget(outcome);
    setMenuOpen(null);
  };

  const handleLogSave = async (value: number, logDate: string | null) => {
    if (!logTarget) return;
    try {
      const res = await fetch(`/api/goals/${logTarget.id}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value, loggedAt: logDate }),
      });
      if (res.ok) {
        // Only create an ad-hoc task if the outcome does NOT have autoCreateTasks enabled
        // (when autoCreateTasks is on, a recurring task already exists for this outcome)
        if (!logTarget.autoCreateTasks) {
          const taskRes = await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: logTarget.name,
              pillarId: logTarget.pillarId || null,
              completionType: logTarget.completionType || "numeric",
              target: value,
              unit: logTarget.unit || null,
              frequency: "adhoc",
              goalId: logTarget.id,
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
        await fetchGoals();
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

  if (loading) return <GoalsLoading />;

  return (
    <div className="px-3 py-4 md:px-6 md:py-6">
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

        {/* Search */}
        <div className="mb-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search goals…"
            className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400"
          />
        </div>

        {/* Goal Type Tabs + Time Tabs */}
        <div className="flex items-center justify-between mb-6 gap-2">
          <div className="hidden md:flex gap-2">
            {([
              { key: "all" as const, label: "All" },
              { key: "habitual" as const, label: "Habitual" },
              { key: "target" as const, label: "Target" },
              { key: "outcome" as const, label: "Outcome" },
              { key: "project" as const, label: "Project" },
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
            onChange={(e) => setGoalTab(e.target.value as "all" | "habitual" | "target" | "outcome" | "project")}
            className="md:hidden px-3 py-2 text-sm font-semibold rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
          >
            <option value="all">All</option>
            <option value="habitual">Habitual</option>
            <option value="target">Target</option>
            <option value="outcome">Outcome</option>
            <option value="project">Project</option>
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
        {filteredGoals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredGoals.map((outcome) => (
              <GoalCard
                key={outcome.id}
                outcome={outcome}
                logsMap={logsMap}
                linkedTasks={linkedTasks}
                menuOpen={menuOpen}
                setMenuOpen={setMenuOpen}
                openLogModal={openLogModal}
                handleArchive={handleArchive}
                handleStatusChange={handleStatusChange}
                getProgress={getProgress}
                today={today}
                taskCompletionDates={taskCompletionDates}
                onAddTask={async (o) => { if (status !== "authenticated") { setAuthSnackbar(true); return; } const ok = await handleAddTaskForToday(o); setSnackbar({ open: true, message: ok ? "Task added and completed" : "Failed to add task", severity: ok ? "success" : "error" }); }}
                cycles={cycles}
                onCopyToCycle={handleCopyToCycle}
              />
            ))}
          </div>
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

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {confirmDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setConfirmDialog(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-800 rounded-xl p-6 mx-4 max-w-sm w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-4">{confirmDialog.message}</p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="px-4 py-2 text-sm rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
