"use client";

import { countScheduledDaysInRange } from "@/lib/effort-calculations";

export default function PerSessionLabel({ form }: { form: { targetValue: string; startDate: string; targetDate: string; frequencyPreset: string; repeatUnit: string; customDays: number[]; monthDay: number; unit: string } }) {
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
    <span className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-center text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50">
      {perSession > 0 ? <>{perSession} {form.unit || ''}/session</> : '—/session'}
    </span>
  );
}
