"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaPlus,
  FaEdit,
  FaArchive,
  FaTimes,
  FaCheck,
  FaArrowUp,
  FaArrowDown,
  FaEllipsisV,
  FaClipboardList,
} from "react-icons/fa";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Outcome {
  id: number;
  pillarId: number | null;
  name: string;
  startValue: number;
  targetValue: number;
  currentValue: number;
  unit: string;
  direction: string;
  logFrequency: string;
  targetDate: string | null;
  pillarName: string | null;
  pillarColor: string | null;
  pillarEmoji: string | null;
}

interface Pillar {
  id: number;
  name: string;
  emoji: string;
  color: string;
}

interface LogEntry {
  id: number;
  value: number;
  loggedAt: string;
  note: string | null;
}

export default function OutcomesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingOutcome, setEditingOutcome] = useState<Outcome | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [logTarget, setLogTarget] = useState<Outcome | null>(null);
  const [logValue, setLogValue] = useState("");
  const [logNote, setLogNote] = useState("");
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState<number | null>(null);
  const [historyLogs, setHistoryLogs] = useState<LogEntry[]>([]);

  const [form, setForm] = useState({
    name: "",
    startValue: "",
    targetValue: "",
    unit: "",
    direction: "decrease",
    pillarId: "",
    logFrequency: "weekly",
    targetDate: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (session?.user?.id) {
      fetchOutcomes();
      fetchPillars();
    }
  }, [session, status]);

  const fetchOutcomes = async () => {
    try {
      const res = await fetch("/api/outcomes");
      if (res.ok) setOutcomes(await res.json());
    } catch (error) {
      console.error("Failed to fetch outcomes:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPillars = async () => {
    try {
      const res = await fetch("/api/pillars");
      if (res.ok) setPillars(await res.json());
    } catch (error) {
      console.error("Failed to fetch pillars:", error);
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.unit.trim() || form.startValue === "" || form.targetValue === "") return;

    const payload = {
      name: form.name,
      startValue: parseFloat(form.startValue),
      targetValue: parseFloat(form.targetValue),
      unit: form.unit,
      direction: form.direction,
      pillarId: form.pillarId ? parseInt(form.pillarId) : null,
      logFrequency: form.logFrequency,
      targetDate: form.targetDate || null,
    };

    try {
      if (editingOutcome) {
        const res = await fetch(`/api/outcomes/${editingOutcome.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) await fetchOutcomes();
      } else {
        const res = await fetch("/api/outcomes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) await fetchOutcomes();
      }
      resetForm();
    } catch (error) {
      console.error("Failed to save outcome:", error);
    }
  };

  const handleArchive = async (id: number) => {
    try {
      await fetch(`/api/outcomes/${id}`, { method: "DELETE" });
      await fetchOutcomes();
    } catch (error) {
      console.error("Failed to archive outcome:", error);
    }
    setMenuOpen(null);
  };

  const handleLogProgress = async () => {
    if (!logTarget || logValue === "") return;

    try {
      const res = await fetch(`/api/outcomes/${logTarget.id}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          value: parseFloat(logValue),
          note: logNote || null,
        }),
      });
      if (res.ok) await fetchOutcomes();
      setShowLogModal(false);
      setLogTarget(null);
      setLogValue("");
      setLogNote("");
    } catch (error) {
      console.error("Failed to log progress:", error);
    }
  };

  const fetchHistory = async (outcomeId: number) => {
    try {
      const res = await fetch(`/api/outcomes/${outcomeId}/log`);
      if (res.ok) setHistoryLogs(await res.json());
    } catch (error) {
      console.error("Failed to fetch history:", error);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingOutcome(null);
    setForm({
      name: "",
      startValue: "",
      targetValue: "",
      unit: "",
      direction: "decrease",
      pillarId: "",
      logFrequency: "weekly",
      targetDate: "",
    });
  };

  const startEdit = (outcome: Outcome) => {
    setEditingOutcome(outcome);
    setForm({
      name: outcome.name,
      startValue: String(outcome.startValue),
      targetValue: String(outcome.targetValue),
      unit: outcome.unit,
      direction: outcome.direction,
      pillarId: outcome.pillarId ? String(outcome.pillarId) : "",
      logFrequency: outcome.logFrequency,
      targetDate: outcome.targetDate || "",
    });
    setShowForm(true);
    setMenuOpen(null);
  };

  const openLogModal = (outcome: Outcome) => {
    setLogTarget(outcome);
    setLogValue(String(outcome.currentValue));
    setLogNote("");
    setShowLogModal(true);
    setMenuOpen(null);
  };

  const getProgress = (outcome: Outcome) => {
    const range = Math.abs(outcome.targetValue - outcome.startValue);
    if (range === 0) return 100;
    const progress = Math.abs(outcome.currentValue - outcome.startValue) / range * 100;
    return Math.max(0, Math.min(progress, 100));
  };

  // Group by pillar
  const grouped: Record<string, Outcome[]> = {};
  for (const o of outcomes) {
    const key = o.pillarId ? `${o.pillarId}` : "none";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(o);
  }

  // Sort keys: pillars first, then "none"
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
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">Outcomes</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Track long-term results and progress</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { resetForm(); setShowForm(true); }}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium flex items-center gap-2"
          >
            <FaPlus /> Add Outcome
          </motion.button>
        </div>

        {/* Grouped Outcomes */}
        {groupKeys.length > 0 ? (
          groupKeys.map((key) => {
            const pillarInfo = getPillarInfo(key);
            return (
              <div key={key} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  {pillarInfo.emoji && <span className="text-lg">{pillarInfo.emoji}</span>}
                  <h2
                    className="text-lg font-semibold"
                    style={{ color: pillarInfo.color }}
                  >
                    {pillarInfo.name}
                  </h2>
                </div>
                <div className="space-y-3">
                  {grouped[key].map((outcome) => {
                    const progress = getProgress(outcome);
                    const color = outcome.pillarColor || "#3B82F6";

                    return (
                      <motion.div
                        key={outcome.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4"
                        style={{ borderLeftWidth: 4, borderLeftColor: color }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900 dark:text-white">{outcome.name}</h3>
                              {outcome.direction === "decrease" ? (
                                <FaArrowDown className="text-xs text-green-500" />
                              ) : (
                                <FaArrowUp className="text-xs text-green-500" />
                              )}
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {outcome.currentValue} {outcome.unit} → {outcome.targetValue} {outcome.unit}
                            </p>
                          </div>
                          <div className="relative">
                            <button
                              onClick={() => setMenuOpen(menuOpen === outcome.id ? null : outcome.id)}
                              className="p-2 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                              <FaEllipsisV className="text-sm" />
                            </button>
                            <AnimatePresence>
                              {menuOpen === outcome.id && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  className="absolute right-0 top-8 w-44 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-20 overflow-hidden"
                                >
                                  <button
                                    onClick={() => openLogModal(outcome)}
                                    className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                  >
                                    <FaClipboardList /> Log Progress
                                  </button>
                                  <button
                                    onClick={() => startEdit(outcome)}
                                    className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                  >
                                    <FaEdit /> Edit
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (showHistory === outcome.id) {
                                        setShowHistory(null);
                                      } else {
                                        setShowHistory(outcome.id);
                                        fetchHistory(outcome.id);
                                      }
                                      setMenuOpen(null);
                                    }}
                                    className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                  >
                                    <FaClipboardList /> History
                                  </button>
                                  <button
                                    onClick={() => handleArchive(outcome.id)}
                                    className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  >
                                    <FaArchive /> Archive
                                  </button>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-1">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(progress, 100)}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: color }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                          <span>{outcome.startValue} {outcome.unit}</span>
                          <span className="font-medium">{Math.round(progress)}%</span>
                          <span>{outcome.targetValue} {outcome.unit}</span>
                        </div>

                        {/* History panel */}
                        <AnimatePresence>
                          {showHistory === outcome.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden mt-3 pt-3 border-t border-gray-200 dark:border-gray-700"
                            >
                              {historyLogs.length === 0 ? (
                                <p className="text-sm text-gray-400">No logs yet</p>
                              ) : (
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                  {historyLogs.map((log) => (
                                    <div key={log.id} className="flex justify-between text-sm">
                                      <span className="text-gray-600 dark:text-gray-400">
                                        {new Date(log.loggedAt).toLocaleDateString()}
                                      </span>
                                      <span className="font-medium text-gray-900 dark:text-white">
                                        {log.value} {outcome.unit}
                                      </span>
                                      {log.note && (
                                        <span className="text-gray-400 text-xs truncate max-w-[120px]">{log.note}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="text-lg mb-2">No outcomes yet</p>
            <p className="text-sm">Create your first outcome to start tracking progress</p>
          </div>
        )}

        {/* Add/Edit Form Modal */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={resetForm}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {editingOutcome ? "Edit Outcome" : "New Outcome"}
                  </h2>
                  <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <FaTimes />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="e.g., Body Weight"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pillar (optional)</label>
                    <select
                      value={form.pillarId}
                      onChange={(e) => setForm({ ...form, pillarId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">No Pillar</option>
                      {pillars.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.emoji} {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Value</label>
                      <input
                        type="number"
                        step="any"
                        value={form.startValue}
                        onChange={(e) => setForm({ ...form, startValue: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="e.g., 98.6"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Value</label>
                      <input
                        type="number"
                        step="any"
                        value={form.targetValue}
                        onChange={(e) => setForm({ ...form, targetValue: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="e.g., 90"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit</label>
                      <input
                        type="text"
                        value={form.unit}
                        onChange={(e) => setForm({ ...form, unit: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="e.g., kg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Direction</label>
                      <select
                        value={form.direction}
                        onChange={(e) => setForm({ ...form, direction: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="decrease">Decrease</option>
                        <option value="increase">Increase</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Log Frequency</label>
                      <select
                        value={form.logFrequency}
                        onChange={(e) => setForm({ ...form, logFrequency: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Date</label>
                      <input
                        type="date"
                        value={form.targetDate}
                        onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSubmit}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                    >
                      <FaCheck /> {editingOutcome ? "Update" : "Create"}
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={resetForm}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium"
                    >
                      Cancel
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Log Progress Modal */}
        <AnimatePresence>
          {showLogModal && logTarget && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => { setShowLogModal(false); setLogTarget(null); }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Log Progress</h2>
                  <button
                    onClick={() => { setShowLogModal(false); setLogTarget(null); }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <FaTimes />
                  </button>
                </div>

                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{logTarget.name}</p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Value ({logTarget.unit})
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={logValue}
                      onChange={(e) => setLogValue(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      autoFocus
                    />
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
                      onClick={handleLogProgress}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                    >
                      <FaCheck /> Save
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { setShowLogModal(false); setLogTarget(null); }}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium"
                    >
                      Cancel
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
