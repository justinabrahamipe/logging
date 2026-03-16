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
