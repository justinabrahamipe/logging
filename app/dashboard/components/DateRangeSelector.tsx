"use client";

interface DateRangeSelectorProps {
  startDate: string;
  endDate: string;
  onChangeStart: (d: string) => void;
  onChangeEnd: (d: string) => void;
  preset: string;
  onPreset: (p: string) => void;
  showDay?: boolean;
}

export default function DateRangeSelector({
  startDate,
  endDate,
  onChangeStart,
  onChangeEnd,
  preset,
  onPreset,
  showDay = false,
}: DateRangeSelectorProps) {
  const allPresets = [
    { key: "day", label: "Day" },
    { key: "week", label: "Week" },
    { key: "month", label: "Month" },
    { key: "quarter", label: "Quarter" },
    { key: "custom", label: "Custom" },
  ];
  const presets = showDay ? allPresets : allPresets.filter(p => p.key !== "day");
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Mobile: dropdown */}
      <select
        value={preset}
        onChange={(e) => onPreset(e.target.value)}
        className="md:hidden px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border-0"
      >
        {presets.map((p) => (
          <option key={p.key} value={p.key}>{p.label}</option>
        ))}
      </select>
      {/* Desktop: pill buttons */}
      <div className="hidden md:flex items-center gap-1.5">
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => onPreset(p.key)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              preset === p.key
                ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-600"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset === "custom" && (
        <div className="flex items-center gap-1.5 text-xs">
          <input
            type="date"
            value={startDate}
            onChange={(e) => onChangeStart(e.target.value)}
            className="px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border-0 text-xs"
          />
          <span className="text-zinc-400">-</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onChangeEnd(e.target.value)}
            className="px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border-0 text-xs"
          />
        </div>
      )}
    </div>
  );
}
