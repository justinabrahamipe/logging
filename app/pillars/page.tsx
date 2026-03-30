"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { FaPlus, FaEdit, FaArchive } from "react-icons/fa";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { DEMO_PILLARS } from "@/lib/demo-data";
import PillarsLoading from "./loading";
import type { Pillar, CycleInfo, CyclePerformance } from "@/lib/types";

export default function PillarsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [cyclesData, setCyclesData] = useState<CycleInfo[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<number>(0);
  const [perfData, setPerfData] = useState<CyclePerformance | null>(null);
  const [, setPerfLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      setPillars(DEMO_PILLARS.map(p => ({ ...p, description: p.description })) as Pillar[]);
      setLoading(false);
      return;
    }
    if (session?.user?.id) {
      fetchPillars();
      fetch('/api/cycles').then(r => r.ok ? r.json() : []).then(setCyclesData).catch(() => {});
    }
  }, [session, status]);

  useEffect(() => {
    if (cyclesData.length > 0 && !selectedCycleId) {
      setSelectedCycleId(cyclesData.find(c => c.isActive)?.id || cyclesData[0]?.id || 0);
    }
  }, [cyclesData, selectedCycleId]);

  useEffect(() => {
    if (!selectedCycleId) return;
    setPerfLoading(true);
    fetch(`/api/cycles/${selectedCycleId}/performance`)
      .then(res => res.ok ? res.json() : null)
      .then(data => setPerfData(data))
      .finally(() => setPerfLoading(false));
  }, [selectedCycleId]);

  const pillarChartMap = useMemo(() => {
    if (!perfData || pillars.length === 0) return new Map<number, { date: string; score: number | null; avg: number | null; ideal: number }[]>();

    const cycle = perfData.cycle;
    const startDate = new Date(cycle.startDate + 'T12:00:00');
    const totalDays = cycle.totalDays;

    const allDates: string[] = [];
    for (let i = 0; i <= totalDays; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      allDates.push(d.toISOString().split('T')[0]);
    }

    const scoreMap = new Map<number, Map<string, number>>();
    for (const e of perfData.effort) {
      for (const [pid, pScore] of Object.entries(e.pillarScores || {})) {
        const pillarId = Number(pid);
        if (!scoreMap.has(pillarId)) scoreMap.set(pillarId, new Map());
        scoreMap.get(pillarId)!.set(e.date, pScore as number);
      }
    }

    const result = new Map<number, { date: string; score: number | null; avg: number | null; ideal: number }[]>();
    for (const pillar of pillars) {
      const scores = scoreMap.get(pillar.id) || new Map<string, number>();
      let sum = 0;
      let count = 0;
      const data = allDates.map(dateStr => {
        const score = scores.get(dateStr) ?? null;
        if (score !== null) { sum += score; count++; }
        return {
          date: dateStr.slice(5),
          score,
          avg: count > 0 ? Math.round(sum / count) : null,
          ideal: 100,
        };
      });
      result.set(pillar.id, data);
    }
    return result;
  }, [perfData, pillars]);

  const fetchPillars = async () => {
    try {
      const res = await fetch('/api/pillars');
      if (res.ok) setPillars(await res.json());
    } catch (error) {
      console.error("Failed to fetch pillars:", error);
    } finally {
      setLoading(false);
    }
  };


  const handleArchive = async (id: number) => {
    try {
      await fetch(`/api/pillars/${id}`, { method: 'DELETE' });
      await fetchPillars();
    } catch (error) {
      console.error("Failed to archive pillar:", error);
    }
  };


  if (loading) return <PillarsLoading />;

  return (
    <div className="px-3 py-4 md:px-6 md:py-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white">Pillars</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Life areas that matter to you</p>
          </div>
        </div>

        {/* Cycle Selector */}
        {pillars.length > 0 && cyclesData.length > 0 && (
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 mb-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Cycle</h3>
              <select
                value={selectedCycleId}
                onChange={e => setSelectedCycleId(parseInt(e.target.value))}
                className="px-2 py-1 text-xs border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
              >
                {cyclesData.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.isActive ? ' (Active)' : ''}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Pillar Cards with integrated charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {pillars.map((pillar) => {
            const chartData = pillarChartMap.get(pillar.id) || [];
            chartData.some(d => d.score !== null);
            const latestAvg = chartData.filter(d => d.avg !== null).pop()?.avg;

            return (
              <motion.div
                key={pillar.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => status === "authenticated" && router.push(`/pillars/${pillar.id}`)}
                className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 cursor-pointer hover:shadow transition-shadow"
                style={{ borderLeftWidth: 4, borderLeftColor: pillar.color }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{pillar.emoji}</span>
                    <div>
                      <h3 className="font-semibold text-zinc-900 dark:text-white">{pillar.name}</h3>
                      {pillar.description && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{pillar.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {latestAvg != null && (
                      <span className="text-sm font-bold" style={{ color: pillar.color }}>{latestAvg}%</span>
                    )}
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{pillar.defaultBasePoints ?? 10} pts</span>
                    <button
                      onClick={() => router.push(`/pillars/${pillar.id}/edit`)}
                      className="p-1.5 rounded text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-400"
                    >
                      <FaEdit className="text-sm" />
                    </button>
                    <button
                      onClick={() => handleArchive(pillar.id)}
                      className="p-1.5 rounded text-red-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                      <FaArchive className="text-sm" />
                    </button>
                  </div>
                </div>

              </motion.div>
            );
          })}
        </div>

        {pillars.length === 0 && (
          <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
            <p className="text-lg mb-2">No pillars yet</p>
            <p className="text-sm">Create your first life pillar to get started</p>
          </div>
        )}

      </motion.div>

      {/* Floating Add Pillar button */}
      <button
        onClick={() => router.push("/pillars/new")}
        className="fixed bottom-20 md:bottom-14 right-4 md:right-8 z-40 w-12 h-12 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-lg flex items-center justify-center hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
      >
        <FaPlus className="text-lg" />
      </button>
    </div>
  );
}
