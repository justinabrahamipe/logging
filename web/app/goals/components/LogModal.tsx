"use client";

import { useState } from "react";
import { parseScheduleDays } from "@/lib/format";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaCheck } from "react-icons/fa";
import { calculateEffortMetrics } from "@/lib/effort-calculations";
import { Outcome } from "../types";

export default function LogModal({
  logTarget,
  onClose,
  onSave,
}: {
  logTarget: Outcome;
  onClose: () => void;
  onSave: (value: number, logDate: string | null) => Promise<void>;
}) {
  const getInitialValue = () => {
    if (logTarget.goalType === "target") {
      const days = parseScheduleDays(logTarget.scheduleDays);
      if (logTarget.startDate && logTarget.targetDate && days.length > 0) {
        const metrics = calculateEffortMetrics(
          logTarget.startDate, logTarget.targetDate, days,
          logTarget.targetValue, logTarget.currentValue,
          new Date().toISOString().split("T")[0], logTarget.startValue
        );
        return String(metrics.dailyTarget);
      }
      return "1";
    }
    if (logTarget.goalType === "habitual") {
      if (logTarget.completionType === "checkbox") return "1";
      return String(logTarget.dailyTarget || 1);
    }
    return String(logTarget.currentValue);
  };

  const [logValue, setLogValue] = useState(getInitialValue);
  const [logDate, setLogDate] = useState(() => new Date().toISOString().split("T")[0]);

  const handleSubmit = async () => {
    if (logValue === "") return;
    await onSave(parseFloat(logValue), logDate || null);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm w-full max-w-sm p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
              {logTarget.goalType === "outcome" ? "Log Progress" : "Log Activity"}
            </h2>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              <FaTimes />
            </button>
          </div>

          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">{logTarget.name}</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Date</label>
              <input
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
              />
            </div>

            <div>
              {(() => {
                const ct = logTarget.goalType === "outcome" ? "numeric"
                  : logTarget.goalType === "target" ? (logTarget.completionType === "numeric" ? "numeric" : "count")
                  : (logTarget.completionType || "checkbox");
                if (ct === "checkbox") {
                  return (
                    <>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Did you complete it?</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setLogValue("1")}
                          className={`flex-1 py-3 text-sm font-semibold rounded-lg transition-colors ${
                            logValue === "1"
                              ? "bg-green-500 text-white"
                              : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
                          }`}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogValue("0")}
                          className={`flex-1 py-3 text-sm font-semibold rounded-lg transition-colors ${
                            logValue === "0"
                              ? "bg-red-500 text-white"
                              : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
                          }`}
                        >
                          No
                        </button>
                      </div>
                    </>
                  );
                }
                if (ct === "count") {
                  return (
                    <>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        How many {logTarget.unit || ""} today?
                      </label>
                      {logTarget.dailyTarget && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                          Daily target: {logTarget.dailyTarget} {logTarget.unit}
                        </p>
                      )}
                      <input
                        type="number"
                        value={logValue}
                        onChange={(e) => setLogValue(e.target.value)}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                        placeholder={logTarget.dailyTarget ? String(logTarget.dailyTarget) : "0"}
                        autoFocus
                      />
                      {logTarget.goalType === "target" && logValue && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                          Total after: {logTarget.currentValue + parseFloat(logValue || "0")}/{logTarget.targetValue} {logTarget.unit}
                        </p>
                      )}
                    </>
                  );
                }
                // numeric
                return (
                  <>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Value ({logTarget.unit}) {logTarget.dailyTarget ? `(target: ${logTarget.dailyTarget})` : ""}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={logValue}
                      onChange={(e) => setLogValue(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                      placeholder={logTarget.dailyTarget ? String(logTarget.dailyTarget) : "0"}
                      autoFocus
                    />
                    {logTarget.goalType === "target" && logValue && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        Total after: {logTarget.currentValue + parseFloat(logValue || "0")}/{logTarget.targetValue} {logTarget.unit}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="flex gap-3 pt-2">
              <motion.button
                onClick={handleSubmit}
                className="flex-1 py-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-lg font-medium flex items-center justify-center gap-2"
              >
                <FaCheck /> Save
              </motion.button>
              <motion.button
                onClick={onClose}
                className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium"
              >
                Cancel
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
