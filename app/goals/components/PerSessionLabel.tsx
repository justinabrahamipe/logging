"use client";

import { countScheduledDaysInRange } from "@/lib/effort-calculations";

function getScheduleDays(form: { frequencyPreset: string; repeatUnit: string; customDays: number[]; monthDay: number }): number[] {
  if (form.frequencyPreset === 'daily') return [0,1,2,3,4,5,6];
  if (form.frequencyPreset === 'weekdays') return [1,2,3,4,5];
  if (form.frequencyPreset === 'custom') {
    return form.repeatUnit === 'weeks' ? form.customDays : [form.monthDay];
  }
  return [];
}

function computeTargetDate(startDate: string, totalSessions: number, scheduleDays: number[]): string {
  if (!startDate || totalSessions <= 0 || scheduleDays.length === 0) return "";
  let count = 0;
  const d = new Date(startDate + 'T12:00:00');
  // cap at 5 years to avoid infinite loop
  for (let i = 0; i < 1825 && count < totalSessions; i++) {
    if (scheduleDays.includes(d.getDay())) count++;
    if (count < totalSessions) d.setDate(d.getDate() + 1);
  }
  return d.toISOString().split('T')[0];
}

interface PerSessionProps {
  form: { targetValue: string; startDate: string; targetDate: string; dailyTarget: string; frequencyPreset: string; repeatUnit: string; customDays: number[]; monthDay: number; unit: string };
  onFormChange: (updates: Record<string, string>) => void;
}

export default function PerSessionLabel({ form, onFormChange }: PerSessionProps) {
  const scheduleDays = getScheduleDays(form);
  const total = parseFloat(form.targetValue) || 0;

  // Compute per-session from target date
  const days = (form.startDate && form.targetDate && scheduleDays.length > 0)
    ? countScheduledDaysInRange(form.startDate, form.targetDate, scheduleDays)
    : 0;
  const computedPerSession = days > 0 ? Math.ceil(total / days) : 0;

  const handleDailyTargetChange = (val: string) => {
    onFormChange({ dailyTarget: val });
    const perDay = parseFloat(val) || 0;
    if (perDay > 0 && total > 0 && form.startDate && scheduleDays.length > 0) {
      const sessionsNeeded = Math.ceil(total / perDay);
      const newDate = computeTargetDate(form.startDate, sessionsNeeded, scheduleDays);
      if (newDate) onFormChange({ dailyTarget: val, targetDate: newDate });
    }
  };

  const showComputed = form.targetDate && computedPerSession > 0 && !form.dailyTarget;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 max-w-sm">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Per session</label>
          <input
            type="number"
            step="any"
            value={form.dailyTarget}
            onChange={(e) => handleDailyTargetChange(e.target.value)}
            placeholder={computedPerSession > 0 ? String(computedPerSession) : "e.g., 10"}
            className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
          />
        </div>
        <div className="flex items-end pb-1">
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            {days > 0 ? `${days} sessions total` : form.startDate ? 'Set target date or per session' : 'Set start date first'}
          </p>
        </div>
      </div>
      {showComputed && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          ~{computedPerSession} {form.unit || ''}/session based on target date
        </p>
      )}
    </div>
  );
}
