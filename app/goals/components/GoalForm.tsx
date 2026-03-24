"use client";

import { useState } from "react";
import { FaCheck } from "react-icons/fa";
import { countScheduledDaysInRange } from "@/lib/effort-calculations";
import { Outcome, Pillar, CycleOption, GoalFormState } from "../types";
import { DAY_NAMES, FREQUENCY_PRESETS, REPEAT_UNITS } from "../constants";
import PerSessionLabel from "./PerSessionLabel";

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
  minimumTarget: "",
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
  defaultGoalType?: "habitual" | "target" | "outcome";
  pillars: Pillar[];
  cycles: CycleOption[];
  onCancel: () => void;
  onSave: (payload: Record<string, unknown>, isEdit: boolean) => Promise<void>;
  disabled?: boolean;
}) {
  const [form, setForm] = useState<GoalFormState>(() => {
    if (editingOutcome) {
      const parsedDays: number[] = editingOutcome.scheduleDays ? JSON.parse(editingOutcome.scheduleDays) : [];
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
        unit: editingOutcome.unit,
        pillarId: editingOutcome.pillarId ? String(editingOutcome.pillarId) : "",
        startDate: editingOutcome.startDate || "",
        targetDate: editingOutcome.targetDate || "",
        periodId: editingOutcome.periodId ? String(editingOutcome.periodId) : "",
        goalType: (editingOutcome.goalType === "effort" ? "target" : editingOutcome.goalType as "habitual" | "target" | "outcome") || "outcome",
        completionType: (editingOutcome.completionType as "checkbox" | "count" | "numeric" | "duration") || "checkbox",
        dailyTarget: editingOutcome.dailyTarget ? String(editingOutcome.dailyTarget) : "",
        minimumTarget: editingOutcome.minimumTarget ? String(editingOutcome.minimumTarget) : "",
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
    const todayStr = new Date().toISOString().split('T')[0];
    const activeCycle = cycles.find(c => c.startDate <= todayStr && c.endDate >= todayStr);
    return {
      ...DEFAULT_FORM,
      goalType,
      completionType: goalType === "target" ? "count" : goalType === "outcome" ? "numeric" : "checkbox",
      periodId: activeCycle ? String(activeCycle.id) : "",
      startDate: activeCycle ? activeCycle.startDate : "",
      targetDate: activeCycle ? activeCycle.endDate : "",
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

  const getScheduleDays = (): number[] => {
    if (form.frequencyPreset === 'daily') return [0,1,2,3,4,5,6];
    if (form.frequencyPreset === 'weekdays') return [1,2,3,4,5];
    if (form.frequencyPreset === 'custom') return form.repeatUnit === 'weeks' ? form.customDays : [form.monthDay];
    return [];
  };

  const computeTargetDate = (perDay: number) => {
    const total = parseFloat(form.targetValue) || 0;
    const sched = getScheduleDays();
    if (perDay <= 0 || total <= 0 || !form.startDate || sched.length === 0) return;
    const sessionsNeeded = Math.ceil(total / perDay);
    let count = 0;
    const d = new Date(form.startDate + 'T12:00:00');
    for (let i = 0; i < 1825 && count < sessionsNeeded; i++) {
      if (sched.includes(d.getDay())) count++;
      if (count < sessionsNeeded) d.setDate(d.getDate() + 1);
    }
    setForm(prev => ({ ...prev, targetDate: d.toISOString().split('T')[0] }));
  };

  const computeMinPerDay = (targetDate: string) => {
    const total = parseFloat(form.targetValue) || 0;
    const sched = getScheduleDays();
    if (total <= 0 || !form.startDate || !targetDate || sched.length === 0) return;
    const days = countScheduledDaysInRange(form.startDate, targetDate, sched);
    if (days > 0) {
      setForm(prev => ({ ...prev, minimumTarget: String(Math.ceil(total / days)) }));
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    const isHabitual = form.goalType === "habitual";
    const isTarget = form.goalType === "target";
    const isOutcome = form.goalType === "outcome";

    if ((isTarget || isOutcome) && form.targetValue === "") return;
    if (isOutcome && form.startValue === "") return;
    if (!isHabitual && !form.unit.trim()) return;

    const start = isOutcome ? parseFloat(form.startValue) : 0;
    const target = isHabitual ? 0 : parseFloat(form.targetValue);

    const payload: Record<string, unknown> = {
      name: form.name,
      startValue: start,
      targetValue: target,
      unit: isHabitual ? (form.unit || "days") : form.unit,
      pillarId: form.pillarId ? parseInt(form.pillarId) : null,
      startDate: form.startDate || null,
      targetDate: form.targetDate || null,
      periodId: form.periodId ? parseInt(form.periodId) : null,
      goalType: form.goalType,
      completionType: form.completionType,
      dailyTarget: form.dailyTarget ? parseFloat(form.dailyTarget) : null,
      minimumTarget: form.minimumTarget ? parseFloat(form.minimumTarget) : null,
      flexibilityRule: form.flexibilityRule,
      limitValue: form.flexibilityRule === 'limit_avoid' && form.dailyTarget ? parseFloat(form.dailyTarget) : null,
    };

    {
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
        {!editingOutcome && (
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Goal Type</label>
            <select
              value={form.goalType}
              onChange={(e) => {
                const type = e.target.value as "habitual" | "target" | "outcome";
                setForm((prev) => ({
                  ...prev,
                  goalType: type,
                  completionType: type === "target" ? "count" : type === "outcome" ? "numeric" : prev.completionType,
                }));
              }}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
            >
              <option value="habitual">Habitual</option>
              <option value="target">Target</option>
              <option value="outcome">Outcome</option>
            </select>
          </div>
        )}
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

      {/* Tracking Type + Per-session target */}
      {form.goalType !== "outcome" && (
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Tracking Type</label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {(form.goalType === "habitual"
              ? (["checkbox", "count", "numeric", "duration"] as const)
              : (["count", "numeric", "duration"] as const)
            ).map((ct) => (
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
          {form.completionType !== "checkbox" && (form.goalType === "habitual" || form.goalType === "target") && (
            <div className="mt-2">
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
          )}
          {form.completionType !== "checkbox" && form.goalType === "habitual" && (
            <div className="mt-2 grid grid-cols-2 gap-2 max-w-sm">
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
          {form.completionType !== "checkbox" && form.goalType === "target" && (
            <div className="mt-2">
              <PerSessionLabel form={form} />
            </div>
          )}
        </div>
      )}

      {/* Row 2: Pillar + Values/Unit — varies by goal type */}
      {form.goalType === "outcome" && (
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

      {form.goalType === "target" && (
        <div className={`grid gap-3 ${form.completionType !== "checkbox" && form.flexibilityRule !== "limit_avoid" ? "grid-cols-3" : "grid-cols-2"}`}>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {form.flexibilityRule === "limit_avoid" ? "Limit Value" : "Target Value"}
            </label>
            <input
              type="number"
              step="any"
              value={form.targetValue}
              onChange={(e) => setForm({ ...form, targetValue: e.target.value })}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
              placeholder={form.completionType === "duration" ? "e.g., 600" : "e.g., 120"}
            />
          </div>
          {form.completionType !== "checkbox" && form.flexibilityRule !== "limit_avoid" && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Min per day</label>
              <input
                type="number"
                step="any"
                value={form.minimumTarget}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm(prev => ({ ...prev, minimumTarget: val }));
                  const perDay = parseFloat(val);
                  if (perDay > 0 && !form.targetDate) computeTargetDate(perDay);
                }}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                placeholder="e.g., 7"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Unit</label>
            <input
              type="text"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              disabled={form.completionType === "duration"}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white disabled:opacity-50"
              placeholder="e.g., chapters"
            />
          </div>
        </div>
      )}

      {/* Row 3: Pillar + Repeat */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Pillar (optional)</label>
          <select
            value={form.pillarId}
            onChange={(e) => setForm({ ...form, pillarId: e.target.value })}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
          >
            <option value="">No Pillar</option>
            {pillars.map((p) => (
              <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
            ))}
          </select>
        </div>
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
      </div>

      {/* Custom repeat options */}
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

      {/* Row 4: Cycle + Start Date + Target Date */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
              if (form.goalType === "target" && e.target.value) computeMinPerDay(e.target.value);
            }}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
          />
        </div>
      </div>

      {/* Row 5: Auto-create toggle + action buttons */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        {!editingOutcome && (
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
            <FaCheck /> {editingOutcome ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
