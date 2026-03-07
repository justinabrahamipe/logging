"use client";

import { useState } from "react";
import { FaCheck, FaPlus, FaMinus } from "react-icons/fa";

interface Pillar {
  id: number;
  name: string;
  emoji: string;
  color: string;
}

interface Outcome {
  id: number;
  pillarId: number | null;
  name: string;
  goalType: string;
}

interface Cycle {
  id: number;
  name: string;
  isActive: boolean;
}

interface Task {
  id: number;
  pillarId: number;
  name: string;
  completionType: string;
  target: number | null;
  unit: string | null;
  frequency: string;
  customDays: string | null;
  repeatInterval: number | null;
  isWeekendTask: boolean;
  basePoints: number;
  outcomeId: number | null;
  periodId: number | null;
  startDate: string | null;
}

interface TaskFormState {
  pillarId: number;
  name: string;
  completionType: string;
  target: string;
  unit: string;
  frequencyPreset: string;
  frequency: string;
  customDays: number[];
  repeatInterval: string;
  repeatUnit: "days" | "weeks" | "months";
  monthDay: number;
  basePoints: string;
  outcomeId: number;
  periodId: number;
  startDate: string;
}

const COMPLETION_TYPES = [
  { value: "checkbox", label: "Checkbox" },
  { value: "count", label: "Count" },
  { value: "duration", label: "Duration (min)" },
  { value: "numeric", label: "Numeric" },
];

const FREQUENCY_PRESETS = [
  { value: "adhoc", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Every weekday (Mon-Fri)" },
  { value: "custom", label: "Custom..." },
];

const REPEAT_UNITS = [
  { value: "days", label: "day" },
  { value: "weeks", label: "week" },
  { value: "months", label: "month" },
];


const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function taskToPreset(task: Task): {
  preset: string;
  repeatInterval: string;
  repeatUnit: "days" | "weeks" | "months";
  customDays: number[];
  monthDay: number;
} {
  const customDays = task.customDays ? JSON.parse(task.customDays) : [];

  if (task.frequency === "adhoc")
    return { preset: "adhoc", repeatInterval: "1", repeatUnit: "days", customDays: [], monthDay: 1 };
  if (task.frequency === "daily")
    return { preset: "daily", repeatInterval: "1", repeatUnit: "days", customDays: [], monthDay: 1 };

  if (task.frequency === "custom" && !task.repeatInterval) {
    const sorted = [...customDays].sort().join(",");
    if (sorted === "1,2,3,4,5")
      return { preset: "weekdays", repeatInterval: "1", repeatUnit: "weeks", customDays, monthDay: 1 };
  }

  if (task.frequency === "weekly") {
    return { preset: "custom", repeatInterval: "1", repeatUnit: "weeks", customDays: [1], monthDay: 1 };
  }

  if (task.frequency === "custom") {
    const weekInterval = task.repeatInterval ? Math.round(task.repeatInterval / 7) : 1;
    return { preset: "custom", repeatInterval: weekInterval.toString(), repeatUnit: "weeks", customDays, monthDay: 1 };
  }

  if (task.frequency === "monthly") {
    return {
      preset: "custom",
      repeatInterval: (task.repeatInterval || 1).toString(),
      repeatUnit: "months",
      customDays: [],
      monthDay: customDays[0] || 1,
    };
  }

  if (task.frequency === "interval") {
    return {
      preset: "custom",
      repeatInterval: (task.repeatInterval || 1).toString(),
      repeatUnit: "days",
      customDays: [],
      monthDay: 1,
    };
  }

  return { preset: "daily", repeatInterval: "1", repeatUnit: "days", customDays: [], monthDay: 1 };
}

export default function TaskForm({
  editingTask,
  pillars,
  outcomes,
  cycles,
  onCancel,
  onSave,
}: {
  editingTask: Task | null;
  pillars: Pillar[];
  outcomes: Outcome[];
  cycles: Cycle[];
  onCancel: () => void;
  onSave: (body: Record<string, unknown>, isEdit: boolean) => Promise<void>;
}) {
  const [form, setForm] = useState<TaskFormState>(() => {
    if (editingTask) {
      const freq = taskToPreset(editingTask);
      return {
        pillarId: editingTask.pillarId,
        name: editingTask.name,
        completionType: editingTask.completionType,
        target: editingTask.target?.toString() || "",
        unit: editingTask.unit || "",
        frequencyPreset: freq.preset,
        frequency: editingTask.frequency,
        customDays: freq.customDays,
        repeatInterval: freq.repeatInterval,
        repeatUnit: freq.repeatUnit,
        monthDay: freq.monthDay,
        basePoints: editingTask.basePoints.toString(),
        outcomeId: editingTask.outcomeId || 0,
        periodId: editingTask.periodId || 0,
        startDate: editingTask.startDate || "",
      };
    }
    return {
      pillarId: pillars[0]?.id || 0,
      name: "",
      completionType: "checkbox",
      target: "",
      unit: "",
      frequencyPreset: "daily",
      frequency: "daily",
      customDays: [],
      repeatInterval: "1",
      repeatUnit: "days",
      monthDay: 1,
      basePoints: "10",
      outcomeId: 0,
      periodId: 0,
      startDate: "",
    };
  });

  const [saving, setSaving] = useState(false);

  const toggleCustomDay = (day: number) => {
    setForm((prev) => ({
      ...prev,
      customDays: prev.customDays.includes(day)
        ? prev.customDays.filter((d) => d !== day)
        : [...prev.customDays, day],
    }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;

    let dbFrequency = form.frequency;
    let dbCustomDays: string | null = null;
    let dbRepeatInterval: number | null = null;

    if (form.frequencyPreset === "weekdays") {
      dbFrequency = "custom";
      dbCustomDays = JSON.stringify([1, 2, 3, 4, 5]);
    } else if (form.frequencyPreset === "custom") {
      if (form.repeatUnit === "weeks") {
        dbFrequency = "custom";
        dbCustomDays = JSON.stringify(form.customDays);
        const interval = parseInt(form.repeatInterval) || 1;
        if (interval > 1) dbRepeatInterval = interval * 7;
      } else if (form.repeatUnit === "months") {
        dbFrequency = "monthly";
        dbCustomDays = JSON.stringify([form.monthDay]);
        const interval = parseInt(form.repeatInterval) || 1;
        if (interval > 1) dbRepeatInterval = interval;
      } else {
        dbFrequency = "interval";
        dbRepeatInterval = parseInt(form.repeatInterval) || 1;
      }
    } else {
      dbFrequency = form.frequencyPreset;
    }

    const body: Record<string, unknown> = {
      pillarId: form.pillarId || null,
      name: form.name,
      completionType: form.completionType,
      frequency: dbFrequency,
      customDays: dbCustomDays,
      repeatInterval: dbRepeatInterval,
      basePoints: parseFloat(form.basePoints) || 10,
    };

    if (form.outcomeId) body.outcomeId = form.outcomeId;
    if (form.periodId) body.periodId = form.periodId;
    body.startDate = form.startDate || null;
    if (form.target) body.target = parseFloat(form.target);
    if (form.unit) body.unit = form.unit;

    setSaving(true);
    try {
      await onSave(body, !!editingTask);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Task Name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="e.g., Gym session"
          autoFocus
        />
      </div>

      {/* Pillar + Points */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pillar</label>
          <select
            value={form.pillarId}
            onChange={(e) => setForm({ ...form, pillarId: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value={0}>None</option>
            {pillars.map((p) => (
              <option key={p.id} value={p.id}>
                {p.emoji} {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Points</label>
          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                setForm({ ...form, basePoints: Math.max(0, (parseFloat(form.basePoints) || 0) - 5).toString() })
              }
              className="w-8 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
            >
              <FaMinus className="text-[10px]" />
            </button>
            <input
              type="number"
              value={form.basePoints}
              onChange={(e) => setForm({ ...form, basePoints: e.target.value })}
              className="flex-1 px-2 py-2 text-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              min="0"
            />
            <button
              onClick={() =>
                setForm({ ...form, basePoints: ((parseFloat(form.basePoints) || 0) + 5).toString() })
              }
              className="w-8 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
            >
              <FaPlus className="text-[10px]" />
            </button>
          </div>
        </div>
      </div>

      {/* Linked Goal + Linked Cycle */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Linked Goal (optional)
          </label>
          <select
            value={form.outcomeId}
            onChange={(e) => setForm({ ...form, outcomeId: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value={0}>None</option>
            {outcomes
              .filter((o) => !form.pillarId || o.pillarId === form.pillarId || !o.pillarId)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.goalType === "effort" ? "* " : ""}
                  {o.name}
                </option>
              ))}
          </select>
        </div>
        {cycles.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Linked Cycle (optional)
            </label>
            <select
              value={form.periodId}
              onChange={(e) => setForm({ ...form, periodId: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value={0}>None</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.isActive ? " (Active)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Completion Type + Repeat */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Completion Type</label>
          <div className="grid grid-cols-4 gap-1">
            {COMPLETION_TYPES.map((ct) => (
              <button
                key={ct.value}
                onClick={() => setForm({ ...form, completionType: ct.value })}
                className={`px-2 py-2 text-xs rounded-lg border transition-colors ${
                  form.completionType === ct.value
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                    : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                }`}
              >
                {ct.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Repeat</label>
          <select
            value={form.frequencyPreset}
            onChange={(e) => setForm({ ...form, frequencyPreset: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {FREQUENCY_PRESETS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Target & Unit + Task Date */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {form.completionType !== "checkbox" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {form.completionType === "duration" ? "Target (minutes)" : "Target"}
              </label>
              <input
                type="number"
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder={form.completionType === "duration" ? "e.g., 30" : "e.g., 8"}
              />
            </div>
            {form.completionType !== "duration" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit</label>
                <input
                  type="text"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., glasses"
                />
              </div>
            )}
          </>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Task Date <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {/* Custom recurrence */}
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
                {DAYS_OF_WEEK.map((day, idx) => (
                  <button
                    key={idx}
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
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium flex items-center gap-2"
        >
          <FaCheck /> {editingTask ? "Update" : "Create"}
        </button>
      </div>
    </div>
  );
}
