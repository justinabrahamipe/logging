"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPlus, FaEdit, FaArchive, FaArrowUp, FaArrowDown, FaTimes, FaCheck } from "react-icons/fa";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

interface Pillar {
  id: number;
  name: string;
  emoji: string;
  color: string;
  weight: number;
  description: string | null;
  sortOrder: number;
}

interface CycleInfo {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

interface CyclePerformance {
  cycle: { id: number; name: string; startDate: string; endDate: string; totalDays: number };
  effort: { date: string; score: number; pillarScores: Record<string, number> }[];
  outcomes: { id: number; name: string; startValue: number; targetValue: number; logs: { date: string; progress: number }[] }[];
  pillars: { id: number; name: string; emoji: string; color: string }[];
}

const EMOJI_OPTIONS = ['💪', '💼', '🚀', '🏠', '📖', '👨‍👩‍👧', '🎯', '💰', '🧠', '🎨', '🏋️', '📌', '⭐', '❤️', '🔥'];
const COLOR_OPTIONS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'];

export default function PillarsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [cyclesData, setCyclesData] = useState<CycleInfo[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<number>(0);
  const [perfData, setPerfData] = useState<CyclePerformance | null>(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPillar, setEditingPillar] = useState<Pillar | null>(null);
  const [form, setForm] = useState({
    name: '',
    emoji: '📌',
    color: '#3B82F6',
    weight: 0,
    description: '',
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (session?.user?.id) {
      fetchPillars();
      fetch('/api/cycles').then(r => r.ok ? r.json() : []).then(setCyclesData).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    try {
      if (editingPillar) {
        const res = await fetch(`/api/pillars/${editingPillar.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (res.ok) await fetchPillars();
      } else {
        const res = await fetch('/api/pillars', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (res.ok) await fetchPillars();
      }
      resetForm();
    } catch (error) {
      console.error("Failed to save pillar:", error);
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

  const handleReorder = async (id: number, direction: 'up' | 'down') => {
    const idx = pillars.findIndex(p => p.id === id);
    if (direction === 'up' && idx <= 0) return;
    if (direction === 'down' && idx >= pillars.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    await Promise.all([
      fetch(`/api/pillars/${pillars[idx].id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: pillars[swapIdx].sortOrder }),
      }),
      fetch(`/api/pillars/${pillars[swapIdx].id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: pillars[idx].sortOrder }),
      }),
    ]);
    await fetchPillars();
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingPillar(null);
    setForm({ name: '', emoji: '📌', color: '#3B82F6', weight: 0, description: '' });
  };

  const startEdit = (pillar: Pillar) => {
    setEditingPillar(pillar);
    setForm({
      name: pillar.name,
      emoji: pillar.emoji,
      color: pillar.color,
      weight: pillar.weight,
      description: pillar.description || '',
    });
    setShowForm(true);
  };

  const totalWeight = pillars.reduce((sum, p) => sum + p.weight, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">Pillars</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Life areas that matter to you</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { resetForm(); setShowForm(true); }}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium flex items-center gap-2"
          >
            <FaPlus /> Add Pillar
          </motion.button>
        </div>

        {/* Weight Distribution + Cycle Selector */}
        {pillars.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Weight Distribution</h3>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-bold ${Math.abs(totalWeight - 100) < 1 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                  {totalWeight}%
                </span>
                {cyclesData.length > 0 && (
                  <select
                    value={selectedCycleId}
                    onChange={e => setSelectedCycleId(parseInt(e.target.value))}
                    className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {cyclesData.map(c => (
                      <option key={c.id} value={c.id}>{c.name}{c.isActive ? ' (Active)' : ''}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div className="flex h-4 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
              {pillars.map((p) => (
                <div
                  key={p.id}
                  style={{ width: `${p.weight}%`, backgroundColor: p.color }}
                  className="transition-all"
                  title={`${p.name}: ${p.weight}%`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Pillar Cards with integrated charts */}
        <div className="space-y-3">
          {pillars.map((pillar, idx) => {
            const chartData = pillarChartMap.get(pillar.id) || [];
            const hasChartData = chartData.some(d => d.score !== null);
            const latestAvg = chartData.filter(d => d.avg !== null).pop()?.avg;

            return (
              <motion.div
                key={pillar.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4"
                style={{ borderLeftWidth: 4, borderLeftColor: pillar.color }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{pillar.emoji}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{pillar.name}</h3>
                      {pillar.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{pillar.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {latestAvg != null && (
                      <span className="text-sm font-bold" style={{ color: pillar.color }}>{latestAvg}%</span>
                    )}
                    <span className="text-xs text-gray-500 dark:text-gray-400">{pillar.weight}%w</span>
                    <button
                      onClick={() => handleReorder(pillar.id, 'up')}
                      disabled={idx === 0}
                      className="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                    >
                      <FaArrowUp className="text-xs" />
                    </button>
                    <button
                      onClick={() => handleReorder(pillar.id, 'down')}
                      disabled={idx === pillars.length - 1}
                      className="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                    >
                      <FaArrowDown className="text-xs" />
                    </button>
                    <button
                      onClick={() => startEdit(pillar)}
                      className="p-1.5 rounded text-blue-500 hover:text-blue-700 dark:hover:text-blue-400"
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

                {/* Inline performance chart */}
                {perfLoading && (
                  <div className="text-center py-3 text-gray-400 text-xs">Loading...</div>
                )}
                {!perfLoading && hasChartData && (
                  <div className="mt-3">
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10, fill: '#9CA3AF' }}
                          tickLine={false}
                          axisLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 10, fill: '#9CA3AF' }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v: number) => `${v}%`}
                        />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: 'var(--tooltip-bg, #1F2937)',
                            border: '1px solid #374151',
                            borderRadius: '6px',
                            color: 'var(--tooltip-text, #F9FAFB)',
                            fontSize: 11,
                            padding: '4px 8px',
                          }}
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          formatter={(value: any, name: any) => [
                            value != null ? `${value}%` : '—',
                            name === 'avg' ? 'Average' : name === 'ideal' ? 'Target' : 'Score',
                          ]}
                        />
                        <Line type="monotone" dataKey="ideal" stroke={pillar.color} strokeWidth={1} strokeDasharray="5 5" dot={false} opacity={0.3} />
                        <Line type="monotone" dataKey="avg" stroke={pillar.color} strokeWidth={2.5} dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {!perfLoading && !hasChartData && selectedCycleId > 0 && (
                  <p className="text-gray-400 dark:text-gray-500 text-xs mt-2">No data yet</p>
                )}
              </motion.div>
            );
          })}
        </div>

        {pillars.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="text-lg mb-2">No pillars yet</p>
            <p className="text-sm">Create your first life pillar to get started</p>
          </div>
        )}

        {/* Add/Edit Form Modal */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={resetForm}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {editingPillar ? 'Edit Pillar' : 'New Pillar'}
                  </h2>
                  <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <FaTimes />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="e.g., Health & Fitness"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Emoji</label>
                    <div className="flex flex-wrap gap-2">
                      {EMOJI_OPTIONS.map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => setForm({ ...form, emoji })}
                          className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center ${
                            form.emoji === emoji ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-100 dark:bg-gray-700'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Color</label>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_OPTIONS.map(color => (
                        <button
                          key={color}
                          onClick={() => setForm({ ...form, color })}
                          className={`w-8 h-8 rounded-full ${form.color === color ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-800' : ''}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Weight (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={form.weight}
                      onChange={e => setForm({ ...form, weight: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                    <input
                      type="text"
                      value={form.description}
                      onChange={e => setForm({ ...form, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Optional description"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSubmit}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                    >
                      <FaCheck /> {editingPillar ? 'Update' : 'Create'}
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={resetForm}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium"
                    >
                      Cancel
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
