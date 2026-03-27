export const COMPLETION_TYPES = [
  { value: "checkbox", label: "Checkbox" },
  { value: "count", label: "Count" },
  { value: "duration", label: "Duration (min)" },
  { value: "numeric", label: "Numeric" },
] as const;

export const FREQUENCY_PRESETS = [
  { value: "adhoc", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Every weekday (Mon-Fri)" },
  { value: "custom", label: "Custom..." },
] as const;

export const GOAL_FREQUENCY_PRESETS = [
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Every weekday (Mon\u2013Fri)" },
  { value: "custom", label: "Custom..." },
] as const;

export const REPEAT_UNITS = [
  { value: "days", label: "day" },
  { value: "weeks", label: "week" },
  { value: "months", label: "month" },
] as const;

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const COMPLETION_TYPE_LABELS: Record<string, string> = {
  checkbox: "Checkbox",
  count: "Counter",
  numeric: "Numeric",
  duration: "Timer",
};

export function getCompletionTypeLabel(type: string): string {
  return COMPLETION_TYPE_LABELS[type] || type;
}

const SHORT_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/**
 * Format schedule days as a short label: "Daily", "Mon–Fri", "Mo, We, Fr", etc.
 */
export function formatScheduleLabel(days: number[]): string {
  if (days.length === 0) return "";
  if (days.length === 7) return "Daily";
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 5 && sorted[0] === 1 && sorted[4] === 5 && sorted.every((d, i) => d === i + 1)) return "Mon–Fri";
  if (sorted.length === 6 && sorted[0] === 1 && sorted[5] === 6 && sorted.every((d, i) => d === i + 1)) return "Mon–Sat";
  const isConsecutive = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (isConsecutive && sorted.length >= 3) return `${SHORT_DAYS[sorted[0]]}–${SHORT_DAYS[sorted[sorted.length - 1]]}`;
  return sorted.map(d => SHORT_DAYS[d]).join(", ");
}
