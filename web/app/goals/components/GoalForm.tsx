"use client";

import { useState } from "react";
import { FaCheck, FaPlus, FaMinus } from "react-icons/fa";
import { countScheduledDaysInRange } from "@/lib/effort-calculations";
import { Outcome, Pillar, CycleOption } from "../types";
import type { GoalFormState } from "@/lib/types";
import { DAY_NAMES, FREQUENCY_PRESETS, REPEAT_UNITS } from "../constants";
import PerSessionLabel from "./PerSessionLabel";
import { getTodayString, parseScheduleDays } from "@/lib/format";

const DEFAULT_FORM: GoalFormState = {
  name: "",
  startValue: "",
  targetValue: "",
  unit: "",
  pillarId: "",
  startDate: "",
  targetDate: "",
  periodId: "",
  goalType: "outcome",
  completionType: "checkbox",
  dailyTarget: "",
  basePoints: "10",
  pointsMode: 'pillar' as const,
  autoCreateTasks: true,
  flexibilityRule: "must_today",
  frequencyPreset: "daily",
  customDays: [],
  repeatInterval: "1",
  repeatUnit: "weeks",
  monthDay: 1,
};

export default function GoalForm({
  editingOutcome,
  defaultGoalType,
  pillars,
  cycles,
  onCancel,
  onSave,
  disabled,
}: {
  editingOutcome: Outcome | null;
  defaultGoalType?: "habitual" | "target" | "outcome" | "project";
  pillars: Pillar[];
  cycles: CycleOption[];
  onCancel: () => void;
  onSave: (payload: Record<string, unknown>, isEdit: boolean) => Promise<void>;
  disabled?: boolean;
}) {
  const [form, setForm] = useState<GoalFormState>(() => {
    if (editingOutcome) {
      const parsedDays: number[] = parseScheduleDays(editingOutcome.scheduleDays);
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
      return {
        name: editingOutcome.name,
        startValue: String(editingOutcome.startValue),
        targetValue: String(editingOutcome.targetValue),
        unit: editingOutcome.unit || "",
        pillarId: editingOutcome.pillarId ? String(editingOutcome.pillarId) : "",
        startDate: editingOutcome.startDate || "",
        targetDate: editingOutcome.targetDate || "",
        periodId: editingOutcome.periodId ? String(editingOutcome.periodId) : "",
        goalType: (editingOutcome.goalType === "effort" ? "target" : editingOutcome.goalType as "habitual" | "target" | "outcome" | "project") || "outcome",
        completionType: (editingOutcome.completionType as "checkbox" | "count" | "numeric" | "duration") || "checkbox",
        dailyTarget: editingOutcome.dailyTarget ? String(editingOutcome.dailyTarget) : "",
        basePoints: String(editingOutcome.basePoints ?? 10),
        pointsMode: (() => {
          const pillar = pillars.find(p => p.id === (editingOutcome.pillarId ?? 0));
          return pillar && (editingOutcome.basePoints ?? 10) === pillar.defaultBasePoints ? 'pillar' as const : 'manual' as const;
        })(),
        autoCreateTasks: editingOutcome.autoCreateTasks || false,
        flexibilityRule: editingOutcome.flexibilityRule || "must_today",
        frequencyPreset,
        customDays,
        repeatInterval: "1",
        repeatUnit: "weeks",
        monthDay: 1,
      };
    }
    const goalType = defaultGoalType || "outcome";
    const todayStr = getTodayString();
    const activeCycle = cycles.find(c => c.startDate <= todayStr && c.endDate >= todayStr);
    return {
      ...DEFAULT_FORM,
      goalType,
      completionType: goalType === "target" ? "count" : goalType === "outcome" ? "numeric" : "checkbox",
      periodId: activeCycle ? String(activeCycle.id) : "",
      startDate: activeCycle ? activeCycle.startDate : "",
      targetDate: activeCycle ? activeCycle.endDate : "",
      autoCreateTasks: goalType === "project" ? false : DEFAULT_FORM.autoCreateTasks,
      unit: goalType === "project" ? "steps" : DEFAULT_FORM.unit,
    };
  });

  const [saving, setSaving] = useState(false);

  const toggleCustomDay = (day: number) => {
    setForm((prev) => ({
      ...prev,
      customDays: prev.customDays.includes(day)
        ? prev.customDays.filter((d) => d !== day)
        : [...prev.customDays, day].sort(),
    }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    const isHabitual = form.goalType === "habitual";
    const isTarget = form.goalType === "target";
    const isOutcome = form.goalType === "outcome";
    const isProject = form.goalType === "project";

    if ((isTarget || isOutcome) && form.targetValue === "") return;
    if (isOutcome && form.startValue === "") return;
    if (!isHabitual && !isProject && !(form.unit || '').trim()) return;

    const start = (isTarget || isOutcome) ? (parseFloat(form.startValue) || 0) : 0;
    const target = isHabitual ? 0 : isProject ? (parseFloat(form.targetValue) || 0) : parseFloat(form.targetValue);

    const payload: Record<string, unknown> = {
      name: form.name,
      startValue: start,
      targetValue: target,
      unit: isHabitual ? (form.unit || "days") : isProject ? "steps" : form.unit,
      pillarId: form.pillarId ? parseInt(form.pillarId) : null,
      startDate: form.startDate || null,
      targetDate: form.targetDate || null,
      periodId: form.periodId ? parseInt(form.periodId) : null,
      goalType: form.goalType,
      completionType: isProject ? "checkbox" : form.completionType,
      dailyTarget: isProject ? null : (form.dailyTarget ? parseFloat(form.dailyTarget) : null),
      flexibilityRule: isProject ? "must_today" : form.flexibilityRule,
      limitValue: form.flexibilityRule === 'limit_avoid' && form.dailyTarget ? parseFloat(form.dailyTarget) : null,
      basePoints: parseFloat(form.basePoints) || 10,
    };

    if (isProject) {
      payload.autoCreateTasks = false;
      payload.scheduleDays = [];
    } else {
      payload.autoCreateTasks = form.autoCreateTasks;

      let scheduleDays: number[] = [];
      const repeatUnit = form.repeatUnit;
      const repeatInterval = parseInt(form.repeatInterval) || 1;

      if (form.frequencyPreset === 'daily') {
        scheduleDays = [0, 1, 2, 3, 4, 5, 6];
      } else if (form.frequencyPreset === 'weekdays') {
        scheduleDays = [1, 2, 3, 4, 5];
      } else if (form.frequencyPreset === 'custom') {
        if (repeatUnit === 'weeks') {
          scheduleDays = form.customDays;
        } else if (repeatUnit === 'months') {
          scheduleDays = [form.monthDay];
        } else {
          scheduleDays = [];
        }
      }

      payload.scheduleDays = scheduleDays;
      payload.repeatInterval = repeatInterval;
      payload.repeatUnit = repeatUnit;

      if (isTarget && form.completionType !== "checkbox" && form.startDate && form.targetDate && scheduleDays.length > 0) {
        const totalTarget = parseFloat(form.targetValue) || 0;
        const days = countScheduledDaysInRange(form.startDate, form.targetDate, scheduleDays);
        if (days > 0) {
          payload.dailyTarget = Math.ceil(totalTarget / days);
        }
      }
    }

    setSaving(true);
    try {
      await onSave(payload, !!editingOutcome);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Row 1: Goal Type + Name */}
      <div className={`grid gap-3 ${!editingOutcome ? "grid-cols-1 md:grid-cols-[200px_1fr]" : ""}`}>
        <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Goal Type</label>
            <select
              value={form.goalType}
              disabled={!!editingOutcome}
              onChange={(e) => {
                const type = e.target.value as "habitual" | "target" | "outcome" | "project";
                setForm((prev) => ({
                  ...prev,
                  goalType: type,
                  completionType: type === "target" ? "count" : type === "outcome" ? "numeric" : type === "project" ? "checkbox" : prev.completionType,
                  unit: type === "project" ? "steps" : prev.unit,
                  autoCreateTasks: type === "project" ? false : prev.autoCreateTasks,
                }));
              }}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="habitual">Habitual</option>
              <option value="target">Target</option>
              <option value="outcome">Outcome</option>
              <option value="project">Project</option>
            </select>
          </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
            placeholder={form.goalType === "habitual" ? "e.g., Go to gym" : form.goalType === "target" ? "e.g., Read 120 chapters" : "e.g., Body Weight"}
          />
        </div>
      </div>

      {/* Tracking Type + Mode + Per-session */}
      {form.goalType !== "outcome" && form.goalType !== "project" && (
        <div>
          {form.goalType === "target" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Tracking Type</label>
                  <div className="flex gap-1">
                    {(["count", "numeric", "duration"] as const).map((ct) => (
                      <button
                        key={ct}
                        type="button"
                        onClick={() => setForm({ ...form, completionType: ct, unit: ct === "duration" ? "min" : (form.completionType === "duration" ? "" : form.unit) })}
                        className={`flex-1 px-2 py-2 text-sm rounded-lg border transition-colors whitespace-nowrap ${
                          form.completionType === ct
                            ? "border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                            : "border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        {ct === "count" ? "Count" : ct === "duration" ? "Timer" : "Numeric"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Mode</label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, flexibilityRule: "must_today" })}
                      className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${
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
                      className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${
                        form.flexibilityRule === "limit_avoid"
                          ? "border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                          : "border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      Limit
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-2">
                <PerSessionLabel form={form} />
              </div>
            </>
          ) : (
            <>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Tracking Type</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {(["checkbox", "count", "numeric", "duration"] as const).map((ct) => (
                  <button
                    key={ct}
                    type="button"
                    onClick={() => setForm({ ...form, completionType: ct, unit: ct === "duration" ? "min" : (form.completionType === "duration" ? "" : form.unit) })}
                    className={`px-2 py-2 text-sm rounded-lg border transition-colors whitespace-nowrap ${
                      form.completionType === ct
                        ? "border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                        : "border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {ct === "checkbox" ? "Checkbox" : ct === "count" ? "Count" : ct === "duration" ? "Timer" : "Numeric"}
                  </button>
                ))}
              </div>
              {form.completionType !== "checkbox" && (
                <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Mode</label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, flexibilityRule: "must_today" })}
                        className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${
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
                        className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${
                          form.flexibilityRule === "limit_avoid"
                            ? "border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                            : "border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        Limit
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      {form.flexibilityRule === "limit_avoid" ? "Per-session limit" : "Per-session target"}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={form.dailyTarget}
                      onChange={(e) => setForm({ ...form, dailyTarget: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                      placeholder="e.g., 30"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Unit</label>
                    <input
                      type="text"
                      value={form.unit}
                      onChange={(e) => setForm({ ...form, unit: e.target.value })}
                      disabled={form.completionType === "duration"}
                      className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white disabled:opacity-50"
                      placeholder="e.g., reps, pages"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Row 2: Pillar + Values/Unit — varies by goal type */}
      {(form.goalType === "outcome" || form.goalType === "target") && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Start Value</label>
            <input
              type="number"
              step="any"
              value={form.startValue}
              onChange={(e) => setForm({ ...form, startValue: e.target.value })}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
              placeholder="e.g., 98.6"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Target Value</label>
            <input
              type="number"
              step="any"
              value={form.targetValue}
              onChange={(e) => setForm({ ...form, targetValue: e.target.value })}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
              placeholder="e.g., 90"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Unit</label>
            <input
              type="text"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
              placeholder="e.g., kg"
            />
          </div>
        </div>
      )}


      {/* Row 3: Pillar + Cycle */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Pillar (optional)</label>
          <select
            value={form.pillarId}
            onChange={(e) => {
              const pid = e.target.value;
              const pillar = pillars.find(p => String(p.id) === pid);
              const updates: Partial<GoalFormState> = { pillarId: pid };
              if (form.pointsMode === 'pillar') {
                updates.basePoints = String(pillar?.defaultBasePoints ?? 10);
              }
              setForm(prev => ({ ...prev, ...updates }));
            }}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
          >
            <option value="">No Pillar</option>
            {pillars.map((p) => (
              <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Goal Cycle</label>
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
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
          >
            <option value="">None</option>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.startDate} → {c.endDate})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Start Date + Target Date + Repeat */}
      <div className={`grid grid-cols-1 gap-3 ${form.goalType === "project" ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Start Date</label>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Target Date</label>
          <input
            type="date"
            value={form.targetDate}
            onChange={(e) => {
              setForm(prev => ({ ...prev, targetDate: e.target.value }));
            }}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
          />
        </div>
        {form.goalType !== "project" && (
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Repeat</label>
            <select
              value={form.frequencyPreset}
              onChange={(e) => setForm({ ...form, frequencyPreset: e.target.value })}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
            >
              {FREQUENCY_PRESETS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Custom repeat options */}
      {form.goalType !== "project" && form.frequencyPreset === "custom" && (
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
                    type="button"
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
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Task Points — hidden for target/outcome goals since their tasks are excluded from action score */}
      {form.goalType !== "target" && form.goalType !== "outcome" && <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Task Points</label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                const pillar = pillars.find(p => String(p.id) === form.pillarId);
                setForm({ ...form, pointsMode: 'pillar', basePoints: String(pillar?.defaultBasePoints ?? 10) });
              }}
              className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap ${
                form.pointsMode === 'pillar'
                  ? "border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  : "border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              Default
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, pointsMode: 'manual' })}
              className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                form.pointsMode === 'manual'
                  ? "border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  : "border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              Manual
            </button>
          </div>
        </div>
        <div className="min-w-0 overflow-hidden">
          {form.pointsMode === 'manual' ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setForm({ ...form, basePoints: String(Math.max(0, (parseFloat(form.basePoints) || 0) - 5)) })}
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
                type="button"
                onClick={() => setForm({ ...form, basePoints: String((parseFloat(form.basePoints) || 0) + 5) })}
                className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-600"
              >
                <FaPlus className="text-[10px]" />
              </button>
            </div>
          ) : (
            <div className="px-3 py-2.5 text-center text-sm font-medium border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              {form.basePoints} pts
            </div>
          )}
        </div>
      </div>}

      {/* Auto-create toggle + action buttons */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        {!editingOutcome && form.goalType !== "project" && (
          <label className="flex items-center gap-2 cursor-pointer mr-auto">
            <div
              className={`relative w-10 h-6 rounded-full transition-colors ${
                form.autoCreateTasks ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-300 dark:bg-zinc-600"
              }`}
              onClick={() => setForm((prev) => ({ ...prev, autoCreateTasks: !prev.autoCreateTasks }))}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  form.autoCreateTasks ? "translate-x-[18px]" : "translate-x-0.5"
                }`}
              />
            </div>
            <span className="text-sm text-zinc-700 dark:text-zinc-300">Auto-create task</span>
          </label>
        )}
        {disabled && (
          <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-4 py-2">
            You need to sign in to add goals
          </p>
        )}
        <div className="flex gap-3 ml-auto">
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
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 dark:border-zinc-900/30 border-t-white dark:border-t-zinc-900 rounded-full animate-spin" />
            ) : (
              <FaCheck />
            )}
            {saving ? "Saving..." : editingOutcome ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
