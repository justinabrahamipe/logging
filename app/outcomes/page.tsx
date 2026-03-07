"use client";

import { useState, useEffect, useMemo } from "react";
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
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { calculateEffortMetrics, countScheduledDaysInRange } from "@/lib/effort-calculations";

interface Outcome {
  id: number;
  pillarId: number | null;
  periodId: number | null;
  name: string;
  startValue: number;
  targetValue: number;
  currentValue: number;
  unit: string;
  direction: string;
  logFrequency: string;
  startDate: string | null;
  targetDate: string | null;
  goalType: string;
  completionType: string;
  dailyTarget: number | null;
  scheduleDays: string | null;
  autoCreateTasks: boolean;
  tolerance: number | null;
  linkedOutcomeId: number | null;
  pillarName: string | null;
  pillarColor: string | null;
  pillarEmoji: string | null;
}

interface CycleOption {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
}

interface Pillar {
  id: number;
  name: string;
  emoji: string;
  color: string;
}

interface LinkedTask {
  id: number;
  name: string;
  outcomeId: number | null;
}

interface LogEntry {
  id: number;
  value: number;
  loggedAt: string;
  note: string | null;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const FREQUENCY_PRESETS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Every weekday (Mon–Fri)' },
  { value: 'custom', label: 'Custom...' },
];

const REPEAT_UNITS = [
  { value: 'days', label: 'day' },
  { value: 'weeks', label: 'week' },
  { value: 'months', label: 'month' },
];

export default function GoalsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [allOutcomes, setAllOutcomes] = useState<Outcome[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingOutcome, setEditingOutcome] = useState<Outcome | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [logTarget, setLogTarget] = useState<Outcome | null>(null);
  const [logValue, setLogValue] = useState("");
  const [logNote, setLogNote] = useState("");
  const [logDate, setLogDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [logsMap, setLogsMap] = useState<Record<number, LogEntry[]>>({});
  const [goalTab, setGoalTab] = useState<"habitual" | "target" | "outcome">("habitual");
  const [timeTab, setTimeTab] = useState<"current" | "future" | "past">("current");
  const [linkedTasks, setLinkedTasks] = useState<LinkedTask[]>([]);
  const [cycles, setCycles] = useState<CycleOption[]>([]);

  const [form, setForm] = useState({
    name: "",
    startValue: "",
    targetValue: "",
    unit: "",
    pillarId: "",
    logFrequency: "weekly",
    startDate: "",
    targetDate: "",
    periodId: "",
    goalType: "outcome" as "habitual" | "target" | "outcome",
    completionType: "checkbox" as "checkbox" | "count" | "numeric",
    dailyTarget: "",
    autoCreateTasks: true,
    tolerance: "0",
    linkedOutcomeId: "",
    frequencyPreset: "daily" as string,
    customDays: [] as number[],
    repeatInterval: "1",
    repeatUnit: "weeks" as "days" | "weeks" | "months",
    monthDay: 1,
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (session?.user?.id) {
      fetchOutcomes();
      fetchPillars();
      fetchLinkedTasks();
      fetchCycles();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status]);

  const fetchOutcomes = async () => {
    try {
      const res = await fetch("/api/outcomes");
      if (res.ok) {
        const data = await res.json();
        setAllOutcomes(data);
        // Auto-select the first tab that has goals
        const typeCounts = { habitual: 0, target: 0, outcome: 0 };
        for (const o of data) {
          const t = o.goalType === "effort" ? "target" : (o.goalType || "outcome");
          if (t in typeCounts) typeCounts[t as keyof typeof typeCounts]++;
        }
        if (typeCounts[goalTab] === 0) {
          if (typeCounts.habitual > 0) setGoalTab("habitual");
          else if (typeCounts.target > 0) setGoalTab("target");
          else if (typeCounts.outcome > 0) setGoalTab("outcome");
        }
        await fetchAllLogs(data);
      }
    } catch (error) {
      console.error("Failed to fetch outcomes:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllLogs = async (outcomesList: Outcome[]) => {
    const entries: Record<number, LogEntry[]> = {};
    await Promise.all(
      outcomesList.map(async (o) => {
        try {
          const res = await fetch(`/api/outcomes/${o.id}/log`);
          if (res.ok) entries[o.id] = await res.json();
        } catch {
          // ignore individual failures
        }
      })
    );
    setLogsMap(entries);
  };

  const fetchPillars = async () => {
    try {
      const res = await fetch("/api/pillars");
      if (res.ok) setPillars(await res.json());
    } catch (error) {
      console.error("Failed to fetch pillars:", error);
    }
  };

  const fetchLinkedTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      if (res.ok) {
        const groups = await res.json();
        const allTasks: LinkedTask[] = [];
        for (const group of groups) {
          for (const task of group.tasks) {
            if (task.outcomeId) {
              allTasks.push({ id: task.id, name: task.name, outcomeId: task.outcomeId });
            }
          }
        }
        setLinkedTasks(allTasks);
      }
    } catch (error) {
      console.error("Failed to fetch linked tasks:", error);
    }
  };

  const fetchCycles = async () => {
    try {
      const res = await fetch("/api/cycles");
      if (res.ok) setCycles(await res.json());
    } catch (error) {
      console.error("Failed to fetch cycles:", error);
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    const isHabitual = form.goalType === "habitual";
    const isTarget = form.goalType === "target";
    const isOutcome = form.goalType === "outcome";

    if ((isTarget || isOutcome) && form.targetValue === "") return;
    if (isOutcome && form.startValue === "") return;
    if (!form.periodId) return; // all goals require a cycle
    if (isHabitual && !form.unit.trim()) {
      // Unit is optional for habitual, default to "days"
    } else if (!isHabitual && !form.unit.trim()) return;

    const start = isOutcome ? parseFloat(form.startValue) : 0;
    const target = isHabitual ? 0 : parseFloat(form.targetValue);

    const payload: Record<string, unknown> = {
      name: form.name,
      startValue: start,
      targetValue: target,
      unit: isHabitual ? (form.unit || "days") : form.unit,
      direction: isOutcome ? (target >= start ? "increase" : "decrease") : "increase",
      pillarId: form.pillarId ? parseInt(form.pillarId) : null,
      logFrequency: isOutcome ? form.logFrequency : "daily",
      startDate: form.startDate || null,
      targetDate: form.targetDate || null,
      periodId: form.periodId ? parseInt(form.periodId) : null,
      goalType: form.goalType,
      completionType: form.completionType,
      dailyTarget: form.dailyTarget ? parseFloat(form.dailyTarget) : null,
    };

    if (isHabitual || isTarget) {
      payload.autoCreateTasks = form.autoCreateTasks;

      // Convert preset to scheduleDays + repeat params (same logic as tasks)
      let scheduleDays: number[] = [];
      let repeatUnit = form.repeatUnit;
      let repeatInterval = parseInt(form.repeatInterval) || 1;

      if (form.frequencyPreset === 'daily') {
        scheduleDays = [0, 1, 2, 3, 4, 5, 6];
        repeatUnit = 'days';
        repeatInterval = 1;
      } else if (form.frequencyPreset === 'weekdays') {
        scheduleDays = [1, 2, 3, 4, 5];
        repeatUnit = 'weeks';
        repeatInterval = 1;
      } else if (form.frequencyPreset === 'custom') {
        if (repeatUnit === 'weeks') {
          scheduleDays = form.customDays;
        } else if (repeatUnit === 'months') {
          scheduleDays = [form.monthDay];
        } else {
          // days - no specific day selection
          scheduleDays = [];
        }
      }

      payload.scheduleDays = scheduleDays;
      payload.repeatInterval = repeatInterval;
      payload.repeatUnit = repeatUnit;
      payload.linkedOutcomeId = form.linkedOutcomeId ? parseInt(form.linkedOutcomeId) : null;
      if (isHabitual) {
        payload.tolerance = parseInt(form.tolerance) || 0;
      }
    }

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
        if (res.ok) {
          await fetchOutcomes();
          await fetchLinkedTasks();
        }
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
          loggedAt: logDate || null,
        }),
      });
      if (res.ok) {
        await fetchOutcomes();
      }
      setShowLogModal(false);
      setLogTarget(null);
      setLogValue("");
      setLogNote("");
    } catch (error) {
      console.error("Failed to log progress:", error);
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
      pillarId: "",
      logFrequency: "weekly",
      startDate: "",
      targetDate: "",
      periodId: "",
      goalType: goalTab,
      completionType: "checkbox",
      dailyTarget: "",
      autoCreateTasks: true,
      tolerance: "0",
      linkedOutcomeId: "",
      frequencyPreset: "daily",
      customDays: [],
      repeatInterval: "1",
      repeatUnit: "weeks" as "days" | "weeks" | "months",
      monthDay: 1,
    });
  };

  const startEdit = (outcome: Outcome) => {
    setEditingOutcome(outcome);
    const parsedDays: number[] = outcome.scheduleDays ? JSON.parse(outcome.scheduleDays) : [];

    // Convert scheduleDays back to preset
    let frequencyPreset = "daily";
    let customDays: number[] = [];
    const sorted = [...parsedDays].sort().join(',');
    if (sorted === '0,1,2,3,4,5,6') {
      frequencyPreset = "daily";
    } else if (sorted === '1,2,3,4,5') {
      frequencyPreset = "weekdays";
    } else if (parsedDays.length > 0) {
      frequencyPreset = "custom";
      customDays = parsedDays;
    }

    setForm({
      name: outcome.name,
      startValue: String(outcome.startValue),
      targetValue: String(outcome.targetValue),
      unit: outcome.unit,
      pillarId: outcome.pillarId ? String(outcome.pillarId) : "",
      logFrequency: outcome.logFrequency,
      startDate: outcome.startDate || "",
      targetDate: outcome.targetDate || "",
      periodId: outcome.periodId ? String(outcome.periodId) : "",
      goalType: (outcome.goalType as "habitual" | "target" | "outcome") || "outcome",
      completionType: (outcome.completionType as "checkbox" | "count" | "numeric") || "checkbox",
      dailyTarget: outcome.dailyTarget ? String(outcome.dailyTarget) : "",
      autoCreateTasks: outcome.autoCreateTasks || false,
      tolerance: String(outcome.tolerance || 0),
      linkedOutcomeId: outcome.linkedOutcomeId ? String(outcome.linkedOutcomeId) : "",
      frequencyPreset,
      customDays,
      repeatInterval: "1",
      repeatUnit: "weeks" as "days" | "weeks" | "months",
      monthDay: 1,
    });
    setShowForm(true);
    setMenuOpen(null);
  };

  const openLogModal = (outcome: Outcome) => {
    setLogTarget(outcome);
    if (outcome.goalType === "target" || outcome.goalType === "effort") {
      // Pre-fill with daily target for effort goals
      const days = outcome.scheduleDays ? JSON.parse(outcome.scheduleDays) : [];
      if (outcome.startDate && outcome.targetDate && days.length > 0) {
        const metrics = calculateEffortMetrics(
          outcome.startDate, outcome.targetDate, days,
          outcome.targetValue, outcome.currentValue,
          new Date().toISOString().split("T")[0]
        );
        setLogValue(String(metrics.dailyTarget));
      } else {
        setLogValue("1");
      }
    } else {
      setLogValue(String(outcome.currentValue));
    }
    setLogNote("");
    setLogDate(new Date().toISOString().split("T")[0]);
    setShowLogModal(true);
    setMenuOpen(null);
  };

  const getProgress = (outcome: Outcome) => {
    const range = Math.abs(outcome.targetValue - outcome.startValue);
    if (range === 0) return 100;
    const progress = Math.abs(outcome.currentValue - outcome.startValue) / range * 100;
    return Math.max(0, Math.min(progress, 100));
  };

  const today = new Date().toISOString().split("T")[0];
  const getTimeCategory = (o: Outcome): "current" | "future" | "past" => {
    if (o.targetDate && o.targetDate < today) return "past";
    if (o.startDate && o.startDate > today) return "future";
    return "current";
  };

  const filteredOutcomes = useMemo(() => {
    return allOutcomes
      .filter((o) => {
        const type = o.goalType === "effort" ? "target" : (o.goalType || "outcome");
        return type === goalTab;
      })
      .filter((o) => getTimeCategory(o) === timeTab);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allOutcomes, goalTab, timeTab]);

  const timeCounts = useMemo(() => {
    const counts = { current: 0, future: 0, past: 0 };
    for (const o of allOutcomes.filter((o) => {
      const type = o.goalType === "effort" ? "target" : (o.goalType || "outcome");
      return type === goalTab;
    })) {
      counts[getTimeCategory(o)]++;
    }
    return counts;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allOutcomes, goalTab]);

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

  const toggleCustomDay = (day: number) => {
    setForm((prev) => ({
      ...prev,
      customDays: prev.customDays.includes(day)
        ? prev.customDays.filter((d) => d !== day)
        : [...prev.customDays, day].sort(),
    }));
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
            onClick={() => {
              resetForm();
              setForm((prev) => ({
                ...prev,
                goalType: goalTab,
                completionType: goalTab === "target" ? "count" : goalTab === "outcome" ? "numeric" : "checkbox",
              }));
              setShowForm(true);
            }}
            className="p-2 md:px-4 md:py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium flex items-center gap-2"
          >
            <FaPlus /> <span className="hidden md:inline">Add {goalTab === "habitual" ? "Habitual Goal" : goalTab === "target" ? "Target Goal" : "Outcome"}</span>
          </motion.button>
        </div>

        {/* Goal Type Tabs + Time Tabs */}
        <div className="flex items-center justify-between mb-6 gap-2">
          {/* Desktop: buttons, Mobile: dropdown */}
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
                      allOutcomes={allOutcomes}
                      menuOpen={menuOpen}
                      setMenuOpen={setMenuOpen}
                      openLogModal={openLogModal}
                      startEdit={startEdit}
                      handleArchive={handleArchive}
                      getProgress={getProgress}
                      today={today}
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
                    {editingOutcome ? "Edit" : "New"} {form.goalType === "habitual" ? "Habitual Goal" : form.goalType === "target" ? "Target Goal" : "Outcome Goal"}
                  </h2>
                  <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <FaTimes />
                  </button>
                </div>

                {/* Goal Type Selector (only for new) */}
                {!editingOutcome && (
                  <div className="flex gap-2 mb-4">
                    {(["habitual", "target", "outcome"] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setForm((prev) => ({
                          ...prev,
                          goalType: type,
                          completionType: type === "target" ? "count" : type === "outcome" ? "numeric" : prev.completionType,
                        }))}
                        className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                          form.goalType === type
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        {type === "habitual" ? "Habitual" : type === "target" ? "Target" : "Outcome"}
                      </button>
                    ))}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder={form.goalType === "habitual" ? "e.g., Go to gym" : form.goalType === "target" ? "e.g., Read 120 chapters" : "e.g., Body Weight"}
                    />
                  </div>

                  {/* Tracking Type + Per-session target */}
                  {form.goalType !== "outcome" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tracking Type</label>
                      <div className="flex gap-2 items-center w-full">
                        {(form.goalType === "habitual"
                          ? (["checkbox", "count", "numeric"] as const)
                          : (["count", "numeric"] as const)
                        ).map((ct) => (
                          <button
                            key={ct}
                            type="button"
                            onClick={() => setForm({ ...form, completionType: ct })}
                            className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                              form.completionType === ct
                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                                : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {ct === "checkbox" ? "Checkbox" : ct === "count" ? "Count" : "Numeric"}
                          </button>
                        ))}
                        {form.completionType !== "checkbox" && (
                          form.goalType === "target" ? (() => {
                            let scheduleDays: number[] = [];
                            if (form.frequencyPreset === 'daily') scheduleDays = [0,1,2,3,4,5,6];
                            else if (form.frequencyPreset === 'weekdays') scheduleDays = [1,2,3,4,5];
                            else if (form.frequencyPreset === 'custom') {
                              scheduleDays = form.repeatUnit === 'weeks' ? form.customDays : [form.monthDay];
                            }
                            const total = parseFloat(form.targetValue) || 0;
                            const days = (form.startDate && form.targetDate && scheduleDays.length > 0)
                              ? countScheduledDaysInRange(form.startDate, form.targetDate, scheduleDays)
                              : 0;
                            const perSession = days > 0 ? Math.ceil(total / days) : 0;
                            return (
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                {perSession > 0 ? <>{perSession} {form.unit}/session</> : null}
                              </span>
                            );
                          })() : (
                            <input
                              type="number"
                              step="any"
                              value={form.dailyTarget}
                              onChange={(e) => setForm({ ...form, dailyTarget: e.target.value })}
                              className="w-24 px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-right"
                              placeholder="/session"
                            />
                          )
                        )}
                      </div>
                    </div>
                  )}

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

                  {form.goalType === "outcome" && (
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
                  )}

                  {form.goalType === "target" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Value</label>
                        <input
                          type="number"
                          step="any"
                          value={form.targetValue}
                          onChange={(e) => setForm({ ...form, targetValue: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="e.g., 120"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit</label>
                        <input
                          type="text"
                          value={form.unit}
                          onChange={(e) => setForm({ ...form, unit: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="e.g., chapters"
                        />
                      </div>
                    </div>
                  )}

                  {form.goalType === "habitual" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tolerance (misses per week)</label>
                      <input
                        type="number"
                        min="0"
                        value={form.tolerance}
                        onChange={(e) => setForm({ ...form, tolerance: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="e.g., 1"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">How many scheduled days you can miss per week and still be on track</p>
                    </div>
                  )}

                  {form.goalType === "outcome" && (
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
                    </div>
                  )}

                  {/* Repeat - same style as tasks */}
                  {(form.goalType === "habitual" || form.goalType === "target") && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Repeat</label>
                        <select
                          value={form.frequencyPreset}
                          onChange={(e) => setForm({ ...form, frequencyPreset: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          {FREQUENCY_PRESETS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      {form.frequencyPreset === "custom" && (
                        <div className="space-y-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Repeat every</label>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                value={form.repeatInterval}
                                onChange={(e) => setForm({ ...form, repeatInterval: e.target.value })}
                                className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                min="1"
                              />
                              <select
                                value={form.repeatUnit}
                                onChange={(e) => setForm({ ...form, repeatUnit: e.target.value as "days" | "weeks" | "months" })}
                                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              >
                                {REPEAT_UNITS.map((u) => (
                                  <option key={u.value} value={u.value}>
                                    {parseInt(form.repeatInterval) > 1 ? u.label + "s" : u.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {form.repeatUnit === "weeks" && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Repeat on</label>
                              <div className="flex gap-1">
                                {DAY_NAMES.map((day, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => toggleCustomDay(idx)}
                                    className={`flex-1 py-2 text-xs rounded-lg border transition-colors ${
                                      form.customDays.includes(idx)
                                        ? "border-blue-500 bg-blue-500 text-white"
                                        : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                                    }`}
                                  >
                                    {day}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {form.repeatUnit === "months" && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">On day</label>
                              <select
                                value={form.monthDay}
                                onChange={(e) => setForm({ ...form, monthDay: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              >
                                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                                  <option key={d} value={d}>{d}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Goal Cycle (required)
                    </label>
                    <select
                      value={form.periodId}
                      onChange={(e) => {
                        const pid = e.target.value;
                        const cycle = cycles.find((c) => String(c.id) === pid);
                        setForm({
                          ...form,
                          periodId: pid,
                          startDate: cycle ? cycle.startDate : form.startDate,
                          targetDate: cycle ? cycle.endDate : form.targetDate,
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">None</option>
                      {cycles.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.startDate} → {c.endDate})</option>
                      ))}
                    </select>
                  </div>

                  {/* Link effort goal to an outcome goal */}
                  {(form.goalType === "habitual" || form.goalType === "target") && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Linked Outcome Goal (optional)</label>
                      <select
                        value={form.linkedOutcomeId}
                        onChange={(e) => setForm({ ...form, linkedOutcomeId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">None</option>
                        {allOutcomes
                          .filter((o) => (o.goalType || "outcome") === "outcome")
                          .map((o) => (
                            <option key={o.id} value={o.id}>{o.name} ({o.currentValue}/{o.targetValue} {o.unit})</option>
                          ))}
                      </select>
                    </div>
                  )}

                  {form.goalType === "outcome" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                        <input
                          type="date"
                          value={form.startDate}
                          onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
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
                  )}

                  {/* Auto-create task toggle for Effort Goals */}
                  {(form.goalType === "habitual" || form.goalType === "target") && !editingOutcome && (
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div
                        className={`relative w-10 h-6 rounded-full transition-colors ${
                          form.autoCreateTasks ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
                        }`}
                        onClick={() => setForm((prev) => ({ ...prev, autoCreateTasks: !prev.autoCreateTasks }))}
                      >
                        <div
                          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                            form.autoCreateTasks ? "translate-x-[18px]" : "translate-x-0.5"
                          }`}
                        />
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">Auto-create task</span>
                    </label>
                  )}

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
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {logTarget.goalType === "outcome" ? "Log Progress" : "Log Activity"}
                  </h2>
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

// ---------- Goal Card Component ----------

function GoalCard({
  outcome,
  logsMap,
  linkedTasks,
  allOutcomes,
  menuOpen,
  setMenuOpen,
  openLogModal,
  startEdit,
  handleArchive,
  getProgress,
  today,
}: {
  outcome: Outcome;
  logsMap: Record<number, LogEntry[]>;
  linkedTasks: LinkedTask[];
  allOutcomes: Outcome[];
  menuOpen: number | null;
  setMenuOpen: (id: number | null) => void;
  openLogModal: (o: Outcome) => void;
  startEdit: (o: Outcome) => void;
  handleArchive: (id: number) => void;
  getProgress: (o: Outcome) => number;
  today: string;
}) {
  const progress = getProgress(outcome);
  const color = outcome.pillarColor || "#3B82F6";
  const isEffort = outcome.goalType === "effort" || outcome.goalType === "target" || outcome.goalType === "habitual";
  const scheduleDays: number[] = outcome.scheduleDays ? JSON.parse(outcome.scheduleDays) : [];

  const effortMetrics = useMemo(() => {
    if (!isEffort || !outcome.startDate || !outcome.targetDate || scheduleDays.length === 0) return null;
    return calculateEffortMetrics(
      outcome.startDate, outcome.targetDate, scheduleDays,
      outcome.targetValue, outcome.currentValue, today
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEffort, outcome.startDate, outcome.targetDate, outcome.targetValue, outcome.currentValue, today, outcome.scheduleDays]);

  return (
    <motion.div
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
            {!isEffort && (
              outcome.direction === "decrease" ? (
                <FaArrowDown className="text-xs text-green-500" />
              ) : (
                <FaArrowUp className="text-xs text-green-500" />
              )
            )}
            {isEffort && effortMetrics && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                effortMetrics.status === 'ahead' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                effortMetrics.status === 'on_track' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {effortMetrics.status === 'ahead' ? 'Ahead' : effortMetrics.status === 'on_track' ? 'On track' : 'Behind'}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {outcome.currentValue} / {outcome.targetValue} {outcome.unit}
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
                  <FaClipboardList /> {isEffort ? "Log Effort" : "Log Progress"}
                </button>
                <button
                  onClick={() => startEdit(outcome)}
                  className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <FaEdit /> Edit
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

      {/* Effort Goal Metrics */}
      {isEffort && effortMetrics && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Today&apos;s target:</span>{" "}
            <span className="font-medium text-gray-900 dark:text-white">{effortMetrics.dailyTarget} {outcome.unit}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Required rate:</span>{" "}
            <span className="font-medium text-gray-900 dark:text-white">{effortMetrics.requiredRate}/day</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Current rate:</span>{" "}
            <span className="font-medium text-gray-900 dark:text-white">{effortMetrics.currentRate}/day</span>
          </div>
          {effortMetrics.projectedDate && (
            <div>
              <span className="text-gray-500 dark:text-gray-400">Projected:</span>{" "}
              <span className="font-medium text-gray-900 dark:text-white">
                {new Date(effortMetrics.projectedDate + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Schedule Days */}
      {isEffort && scheduleDays.length > 0 && (
        <div className="mt-2 flex gap-1">
          {scheduleDays.map((d) => (
            <span key={d} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
              {DAY_NAMES[d]}
            </span>
          ))}
        </div>
      )}

      {/* Linked Outcome Goal */}
      {isEffort && outcome.linkedOutcomeId && (() => {
        const linked = allOutcomes.find(o => o.id === outcome.linkedOutcomeId);
        if (!linked) return null;
        return (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-xs text-gray-500 dark:text-gray-400">Linked to:</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              {linked.name}
            </span>
          </div>
        );
      })()}

      {/* Linked Tasks */}
      {linkedTasks.filter(t => t.outcomeId === outcome.id).length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Linked Tasks</p>
          <div className="flex flex-wrap gap-1">
            {linkedTasks.filter(t => t.outcomeId === outcome.id).map(task => (
              <span key={task.id} className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                {task.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Progress Chart */}
      {(() => {
        const logs = logsMap[outcome.id] || [];
        if (logs.length === 0) return null;

        const sorted = [...logs].sort(
          (a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime()
        );

        const DAY_MS = 86400000;

        if (isEffort) {
          // Cumulative chart for effort goals with ideal line
          const firstLogTime = new Date(sorted[0].loggedAt).getTime();
          const outcomeStartTime = outcome.startDate
            ? new Date(outcome.startDate + "T00:00:00").getTime()
            : firstLogTime;
          const startDay = Math.floor(Math.min(outcomeStartTime, firstLogTime) / DAY_MS) * DAY_MS;
          const endDate = outcome.targetDate
            ? new Date(outcome.targetDate + "T00:00:00")
            : new Date(sorted[sorted.length - 1].loggedAt);
          const endDay = Math.floor(endDate.getTime() / DAY_MS) * DAY_MS;

          const toDayNum = (ts: number) => Math.round((ts - startDay) / DAY_MS);

          // Build cumulative actual data
          let cumulative = 0;
          const chartData: { day: number; actual: number | null; ideal: number | null }[] = [
            { day: 0, actual: 0, ideal: 0 },
          ];

          for (const log of sorted) {
            cumulative += log.value;
            chartData.push({
              day: toDayNum(new Date(log.loggedAt).getTime()),
              actual: cumulative,
              ideal: null,
            });
          }

          // Add ideal line endpoints
          const endDayNum = toDayNum(endDay);
          if (endDayNum > 0) {
            chartData[0].ideal = 0;
            // Add or update end point
            const lastEntry = chartData[chartData.length - 1];
            if (lastEntry.day < endDayNum) {
              chartData.push({ day: endDayNum, actual: null, ideal: outcome.targetValue });
            } else {
              lastEntry.ideal = outcome.targetValue;
            }
          }

          const maxDay = Math.max(endDayNum, chartData[chartData.length - 1].day, 1);
          const formatDay = (day: number) => {
            const d = new Date(startDay + day * DAY_MS);
            return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
          };

          return (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <XAxis
                    dataKey="day"
                    type="number"
                    domain={[0, maxDay]}
                    tickFormatter={formatDay}
                    tick={{ fontSize: 11, fill: "#9CA3AF" }}
                    tickLine={false}
                    axisLine={{ stroke: "#374151" }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#9CA3AF" }}
                    tickLine={false}
                    axisLine={{ stroke: "#374151" }}
                    domain={[0, "auto"]}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "var(--tooltip-bg, #1F2937)",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      color: "var(--tooltip-text, #F9FAFB)",
                      fontSize: 12,
                    }}
                    labelFormatter={(day) => formatDay(day as number)}
                    formatter={(value, name) => [
                      `${value} ${outcome.unit}`,
                      name === "actual" ? "Actual" : "Ideal",
                    ]}
                  />
                  <Line
                    type="linear"
                    dataKey="ideal"
                    stroke="#9CA3AF"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke={color}
                    strokeWidth={2}
                    dot={{ fill: color, r: 3 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        }

        // Standard outcome chart (existing logic)
        const firstLogTime = new Date(sorted[0].loggedAt).getTime();
        const outcomeStartTime = outcome.startDate
          ? new Date(outcome.startDate + "T00:00:00").getTime()
          : firstLogTime;
        const startDay = Math.floor(Math.min(outcomeStartTime, firstLogTime) / DAY_MS) * DAY_MS;
        const endDate = outcome.targetDate
          ? new Date(outcome.targetDate)
          : new Date(sorted[sorted.length - 1].loggedAt);
        const endDay = Math.floor(endDate.getTime() / DAY_MS) * DAY_MS;

        const toDayNum = (ts: number) => Math.round((ts - startDay) / DAY_MS);

        const startPoint = {
          day: 0,
          actual: outcome.startValue as number | null,
          target: outcome.startValue as number | null,
          note: null as string | null,
        };

        const logPoints = sorted.map((log) => ({
          day: toDayNum(new Date(log.loggedAt).getTime()),
          actual: log.value as number | null,
          target: null as number | null,
          note: log.note,
        }));

        const lastLogDay = logPoints[logPoints.length - 1].day;
        const endDayNum = toDayNum(endDay);
        const needsEndPoint = endDayNum > lastLogDay;

        const endPoint = {
          day: endDayNum,
          actual: null as number | null,
          target: outcome.targetValue as number | null,
          note: null as string | null,
        };

        if (!needsEndPoint && logPoints.length > 0) {
          logPoints[logPoints.length - 1].target = outcome.targetValue;
        }

        const chartData = [startPoint, ...logPoints, ...(needsEndPoint ? [endPoint] : [])];
        const maxDay = Math.max(endDayNum, lastLogDay, 1);
        const formatDay = (day: number) => {
          const d = new Date(startDay + day * DAY_MS);
          return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        };

        return (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <XAxis
                  dataKey="day"
                  type="number"
                  domain={[0, maxDay]}
                  tickFormatter={formatDay}
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  tickLine={false}
                  axisLine={{ stroke: "#374151" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  tickLine={false}
                  axisLine={{ stroke: "#374151" }}
                  domain={["auto", "auto"]}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "var(--tooltip-bg, #1F2937)",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    color: "var(--tooltip-text, #F9FAFB)",
                    fontSize: 12,
                  }}
                  labelFormatter={(day) => formatDay(day as number)}
                  formatter={(value, name) => [
                    `${value} ${outcome.unit}`,
                    name === "actual" ? "Actual" : "Target",
                  ]}
                />
                <Line
                  type="linear"
                  dataKey="target"
                  stroke="#9CA3AF"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke={color}
                  strokeWidth={2}
                  dot={{ fill: color, r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      })()}
    </motion.div>
  );
}
