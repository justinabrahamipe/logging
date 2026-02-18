"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPlus, FaEdit, FaArchive, FaArrowUp, FaArrowDown, FaTimes, FaCheck } from "react-icons/fa";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Pillar {
  id: number;
  name: string;
  emoji: string;
  color: string;
  weight: number;
  description: string | null;
  sortOrder: number;
}

const EMOJI_OPTIONS = ['💪', '💼', '🚀', '🏠', '📖', '👨‍👩‍👧', '🎯', '💰', '🧠', '🎨', '🏋️', '📌', '⭐', '❤️', '🔥'];
const COLOR_OPTIONS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'];

export default function PillarsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [pillars, setPillars] = useState<Pillar[]>([]);
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
    if (session?.user?.id) fetchPillars();
  }, [session, status]);

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

        {/* Weight Distribution */}
        {pillars.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Weight Distribution</h3>
              <span className={`text-sm font-bold ${Math.abs(totalWeight - 100) < 1 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                {totalWeight}%
              </span>
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

        {/* Pillar List */}
        <div className="space-y-3">
          {pillars.map((pillar, idx) => (
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
                  <span className="text-sm font-bold text-gray-600 dark:text-gray-400">{pillar.weight}%</span>
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
            </motion.div>
          ))}
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
