"use client";

import { useState } from "react";
import { FaCheck, FaPlus, FaMinus } from "react-icons/fa";
import { COMPLETION_TYPES, FREQUENCY_PRESETS, REPEAT_UNITS, DAY_NAMES } from "@/lib/constants";
import { parseCustomDays } from "@/lib/format";
import type { Pillar, Task, Goal, TaskFormState } from "@/lib/types";


function taskToPreset(task: Task): {
  preset: string;
  repeatInterval: string;
  repeatUnit: "days" | "weeks" | "months";
  customDays: number[];
  monthDay: number;
} {
  const customDays = parseCustomDays(task.customDays);

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
  goals = [],
  onCancel,
  onSave,
  disabled,
}: {
  editingTask: Task | null;
  pillars: Pillar[];
  goals?: Goal[];
  onCancel: () => void;
  onSave: (body: Record<string, unknown>, isEdit: boolean) => Promise<void>;
  disabled?: boolean;
}) {
  const [form, setForm] = useState<TaskFormState>(() => {
    if (editingTask) {
      const freq = taskToPreset(editingTask);
      const pillar = pillars.find(p => p.id === editingTask.pillarId);
      const isPillarDefault = pillar && editingTask.basePoints === pillar.defaultBasePoints;
      return {
        pillarId: editingTask.pillarId,
        goalId: editingTask.goalId || 0,
        name: editingTask.name,
        description: editingTask.description || "",
        completionType: editingTask.completionType,
        target: editingTask.target?.toString() || "",
        unit: editingTask.unit || "",
        flexibilityRule: editingTask.flexibilityRule || "must_today",
        frequencyPreset: freq.preset,
        frequency: editingTask.frequency,
        customDays: freq.customDays,
        repeatInterval: freq.repeatInterval,
        repeatUnit: freq.repeatUnit,
        monthDay: freq.monthDay,
        basePoints: editingTask.basePoints.toString(),
        pointsMode: isPillarDefault ? 'pillar' as const : 'manual' as const,
        startDate: editingTask.startDate || "",
        endDate: editingTask.endDate || "",
      };
    }
    return {
      pillarId: 0,
      goalId: 0,
      name: "",
      description: "",
      completionType: "checkbox",
      target: "",
      unit: "",
      flexibilityRule: "must_today",
      frequencyPreset: "adhoc",
      frequency: "adhoc",
      customDays: [],
      repeatInterval: "1",
      repeatUnit: "days",
      monthDay: 1,
      basePoints: "10",
      pointsMode: 'pillar' as const,
      startDate: (() => {
        try {
          const saved = localStorage.getItem('tasks-filters');
          if (saved) {
            const type = JSON.parse(saved).date?.type;
            if (type === 'today' || type === 'tomorrow') {
              const d = new Date();
              if (type === 'tomorrow') d.setDate(d.getDate() + 1);
              return d.toISOString().split('T')[0];
            }
          }
        } catch {}
        return '';
      })(),
      endDate: '',
    };
  });

  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const activeGoals = goals.filter(g => !g.targetDate || g.targetDate >= today);

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
      goalId: form.goalId || null,
      name: form.name,
      description: form.description || null,
      completionType: form.completionType,
      frequency: dbFrequency,
      customDays: dbCustomDays,
      repeatInterval: dbRepeatInterval,
      basePoints: parseFloat(form.basePoints) || 10,
    };

    body.startDate = form.startDate || null;
    if (form.frequencyPreset !== 'adhoc' && form.endDate) body.endDate = form.endDate;
    body.flexibilityRule = form.flexibilityRule;
    if (form.target) body.target = parseFloat(form.target);
    if (form.unit) body.unit = form.unit;
    if (form.flexibilityRule === 'limit_avoid' && form.target) {
      body.limitValue = parseFloat(form.target);
    }

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
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Task Name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
          placeholder="e.g., Gym session"
          autoFocus
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Description <span className="text-zinc-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white resize-none"
          placeholder="Add a description..."
          rows={2}
        />
      </div>

      {/* Pillar + Linked Goal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Pillar</label>
          <select
            value={form.pillarId}
            onChange={(e) => {
              const pid = parseInt(e.target.value) || 0;
              const pillar = pillars.find(p => p.id === pid);
              const updates: Partial<TaskFormState> = { pillarId: pid };
              if (form.pointsMode === 'pillar') {
                updates.basePoints = (pillar?.defaultBasePoints ?? 10).toString();
              }
              setForm(prev => ({ ...prev, ...updates }));
            }}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
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
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Linked Goal <span className="text-zinc-400 font-normal">(optional)</span>
          </label>
          <select
            value={form.goalId}
            onChange={(e) => {
              const goalId = parseInt(e.target.value) || 0;
              const goal = goals.find(g => g.id === goalId);
              if (goal) {
                setForm({
                  ...form,
                  goalId,
                  startDate: goal.startDate || form.startDate,
                  endDate: goal.targetDate || form.endDate,
                  pillarId: goal.pillarId ?? form.pillarId,
                });
              } else {
                setForm({ ...form, goalId });
              }
            }}
            disabled={activeGoals.length === 0}
            className={`w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white ${activeGoals.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <option value={0}>{activeGoals.length === 0 ? 'No active goals' : 'None'}</option>
            {activeGoals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.pillarEmoji ? `${g.pillarEmoji} ` : ''}{g.name} ({g.goalType})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Points + Task Date */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
        {!(form.goalId && goals.some(g => g.id === form.goalId && (g.goalType === 'target' || g.goalType === 'outcome'))) && <div className="min-w-0 overflow-hidden">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Points</label>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const pillar = pillars.find(p => p.id === form.pillarId);
                setForm({ ...form, pointsMode: 'pillar', basePoints: (pillar?.defaultBasePoints ?? 10).toString() });
              }}
              className={`flex-shrink-0 px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap ${
                form.pointsMode === 'pillar'
                  ? "border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  : "border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              Default
            </button>
            <button
              onClick={() => setForm({ ...form, pointsMode: 'manual' })}
              className={`flex-shrink-0 px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                form.pointsMode === 'manual'
                  ? "border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  : "border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              Manual
            </button>
            <div className="w-px h-6 bg-zinc-300 dark:bg-zinc-600 flex-shrink-0" />
            {form.pointsMode === 'manual' ? (
              <>
                <button
                  onClick={() =>
                    setForm({ ...form, basePoints: Math.max(0, (parseFloat(form.basePoints) || 0) - 5).toString() })
                  }
                  className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-600"
                >
                  <FaMinus className="text-[10px]" />
                </button>
                <input
                  type="number"
                  value={form.basePoints}
                  onChange={(e) => setForm({ ...form, basePoints: e.target.value })}
                  className="flex-1 min-w-0 px-1 py-2 text-center border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                  min="0"
                />
                <button
                  onClick={() =>
                    setForm({ ...form, basePoints: ((parseFloat(form.basePoints) || 0) + 5).toString() })
                  }
                  className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-600"
                >
                  <FaPlus className="text-[10px]" />
                </button>
              </>
            ) : (
              <div className="flex-1 min-w-0 px-3 py-2 text-center text-sm font-medium border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                {form.basePoints} pts
              </div>
            )}
          </div>
        </div>}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            {form.frequencyPreset !== 'adhoc' ? 'Start Date' : 'Task Date'} <span className="text-zinc-400 font-normal">(optional)</span>
          </label>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
          />
        </div>
        {form.frequencyPreset !== 'adhoc' && (
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              End Date <span className="text-zinc-400 font-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              min={form.startDate || undefined}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
            />
          </div>
        )}
      </div>

      {/* Completion Type + Repeat */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Completion Type</label>
          <div className="grid grid-cols-4 gap-1">
            {COMPLETION_TYPES.map((ct) => (
              <button
                key={ct.value}
                onClick={() => setForm({ ...form, completionType: ct.value })}
                className={`px-2 py-2 text-xs rounded-lg border transition-colors ${
                  form.completionType === ct.value
                    ? "border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    : "border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                {ct.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Repeat</label>
          <select
            value={form.frequencyPreset}
            onChange={(e) => setForm({ ...form, frequencyPreset: e.target.value })}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
          >
            {FREQUENCY_PRESETS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Target/Limit Toggle + Target & Unit */}
      {form.completionType !== "checkbox" && (
        <>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Mode</label>
          <div className="grid grid-cols-2 gap-1 max-w-xs">
            <button
              type="button"
              onClick={() => setForm({ ...form, flexibilityRule: "must_today" })}
              className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                form.flexibilityRule !== "limit_avoid"
                  ? "border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  : "border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              Target
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, flexibilityRule: "limit_avoid" })}
              className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                form.flexibilityRule === "limit_avoid"
                  ? "border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                  : "border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              Limit
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {form.flexibilityRule === "limit_avoid"
                ? (form.completionType === "duration" ? "Limit (minutes)" : "Limit")
                : (form.completionType === "duration" ? "Target (minutes)" : "Target")}
            </label>
            <input
              type="number"
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
              placeholder={form.completionType === "duration" ? "e.g., 30" : "e.g., 8"}
            />
          </div>
          {form.completionType !== "duration" && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Unit</label>
              <input
                type="text"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                placeholder="e.g., glasses"
              />
            </div>
          )}
        </div>
        </>
      )}

      {/* Custom recurrence */}
      {form.frequencyPreset === "custom" && (
        <div className="space-y-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Repeat every</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={form.repeatInterval}
                onChange={(e) => setForm({ ...form, repeatInterval: e.target.value })}
                className="w-20 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                min="1"
              />
              <select
                value={form.repeatUnit}
                onChange={(e) => setForm({ ...form, repeatUnit: e.target.value as "days" | "weeks" | "months" })}
                className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
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
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Repeat on</label>
              <div className="flex gap-1">
                {DAY_NAMES.map((day, idx) => (
                  <button
                    key={idx}
                    onClick={() => toggleCustomDay(idx)}
                    className={`flex-1 py-2 text-xs rounded-lg border transition-colors ${
                      form.customDays.includes(idx)
                        ? "border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                        : "border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300"
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
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">On day</label>
              <select
                value={form.monthDay}
                onChange={(e) => setForm({ ...form, monthDay: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
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
      {disabled && (
        <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-4 py-2">
          You need to sign in to add tasks
        </p>
      )}
      <div className="flex gap-3 pt-2 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || disabled}
          className="px-6 py-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed text-white dark:text-zinc-900 rounded-lg font-medium flex items-center gap-2"
        >
          <FaCheck /> {editingTask ? "Update" : "Create"}
        </button>
      </div>
    </div>
  );
}
