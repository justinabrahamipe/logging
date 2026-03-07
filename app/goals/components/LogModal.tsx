"use client";

import { useState } from "react";
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
  onSave: (value: number, note: string | null, logDate: string | null) => Promise<void>;
}) {
  const getInitialValue = () => {
    if (logTarget.goalType === "target") {
      const days = logTarget.scheduleDays ? JSON.parse(logTarget.scheduleDays) : [];
      if (logTarget.startDate && logTarget.targetDate && days.length > 0) {
        const metrics = calculateEffortMetrics(
          logTarget.startDate, logTarget.targetDate, days,
          logTarget.targetValue, logTarget.currentValue,
          new Date().toISOString().split("T")[0]
        );
        return String(metrics.dailyTarget);
      }
      return "1";
    }
    return String(logTarget.currentValue);
  };

  const [logValue, setLogValue] = useState(getInitialValue);
  const [logNote, setLogNote] = useState("");
  const [logDate, setLogDate] = useState(() => new Date().toISOString().split("T")[0]);

  const handleSubmit = async () => {
    if (logValue === "") return;
    await onSave(parseFloat(logValue), logNote || null, logDate || null);
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
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {logTarget.goalType === "outcome" ? "Log Progress" : "Log Activity"}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <FaTimes />
            </button>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{logTarget.name}</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
              <input
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              {(() => {
                const ct = logTarget.completionType || (logTarget.goalType === "habitual" ? "checkbox" : "numeric");
                if (ct === "checkbox") {
                  return (
                    <>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Did you complete it?</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setLogValue("1")}
                          className={`flex-1 py-3 text-sm font-semibold rounded-lg transition-colors ${
                            logValue === "1"
                              ? "bg-green-500 text-white"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
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
                              : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        How many {logTarget.unit || ""}? {logTarget.dailyTarget ? `(target: ${logTarget.dailyTarget})` : ""}
                      </label>
                      <input
                        type="number"
                        value={logValue}
                        onChange={(e) => setLogValue(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder={logTarget.dailyTarget ? String(logTarget.dailyTarget) : "0"}
                        autoFocus
                      />
                      {logTarget.goalType === "target" && logValue && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Total after: {logTarget.currentValue + parseFloat(logValue || "0")}/{logTarget.targetValue} {logTarget.unit}
                        </p>
                      )}
                    </>
                  );
                }
                // numeric
                return (
                  <>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Value ({logTarget.unit}) {logTarget.dailyTarget ? `(target: ${logTarget.dailyTarget})` : ""}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={logValue}
                      onChange={(e) => setLogValue(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder={logTarget.dailyTarget ? String(logTarget.dailyTarget) : "0"}
                      autoFocus
                    />
                    {logTarget.goalType === "target" && logValue && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Total after: {logTarget.currentValue + parseFloat(logValue || "0")}/{logTarget.targetValue} {logTarget.unit}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Note (optional)</label>
              <input
                type="text"
                value={logNote}
                onChange={(e) => setLogNote(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Optional note"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleSubmit}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
              >
                <FaCheck /> Save
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium"
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
