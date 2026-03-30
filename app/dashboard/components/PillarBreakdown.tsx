"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import type { HistoryScore, PillarMeta } from "@/lib/types";
import DateRangeSelector from "./DateRangeSelector";
import { getPresetDates, filterScoresByRange } from "./utils";

interface PillarBreakdownProps {
  scores: HistoryScore[];
  pillarsMeta: PillarMeta[];
}

export default function PillarBreakdown({ scores, pillarsMeta }: PillarBreakdownProps) {
  const [preset, setPreset] = useState("month");
  const [startDate, setStartDate] = useState(() => getPresetDates("month").start);
  const [endDate, setEndDate] = useState(() => getPresetDates("month").end);

  const handlePreset = (p: string) => {
    setPreset(p);
    if (p !== "custom") {
      const { start, end } = getPresetDates(p);
      setStartDate(start);
      setEndDate(end);
    }
  };

  const filtered = useMemo(() => filterScoresByRange(scores, startDate, endDate), [scores, startDate, endDate]);

  const data = useMemo(() => {
    if (filtered.length === 0 || pillarsMeta.length === 0) return [];

    const totals: Record<number, { sum: number; count: number }> = {};
    for (const s of filtered) {
      for (const [pidStr, score] of Object.entries(s.pillarScores)) {
        const pid = Number(pidStr);
        if (!totals[pid]) totals[pid] = { sum: 0, count: 0 };
        totals[pid].sum += score;
        totals[pid].count += 1;
      }
    }

    return pillarsMeta
      .filter((p) => totals[p.id])
      .map((p) => ({
        id: p.id,
        name: p.name,
        emoji: p.emoji,
        color: p.color,
        defaultBasePoints: p.defaultBasePoints,
        avg: Math.round(totals[p.id].sum / totals[p.id].count),
      }));
  }, [filtered, pillarsMeta]);

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
          Pillar Performance
        </h2>
        <DateRangeSelector
          startDate={startDate} endDate={endDate}
          onChangeStart={setStartDate} onChangeEnd={setEndDate}
          preset={preset} onPreset={handlePreset}
          showDay
        />
      </div>
      {data.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400 text-sm text-center py-8">
          No pillar data for this period.
        </p>
      ) : (
        <div className="space-y-3">
          {data.map((pillar) => (
            <div key={pillar.id}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span>{pillar.emoji}</span>
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {pillar.name}
                  </span>
                  <span className="text-[10px] text-zinc-400">({pillar.defaultBasePoints}pts)</span>
                </div>
                <span className="text-sm font-bold text-zinc-900 dark:text-white">
                  {pillar.avg}%
                </span>
              </div>
              <div className="w-full h-3 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(pillar.avg, 100)}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: pillar.color }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
