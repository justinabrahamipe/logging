"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPlus, FaEdit, FaTrash, FaTimes, FaCheck } from "react-icons/fa";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Pillar {
  id: number;
  name: string;
  emoji: string;
  color: string;
}

interface Task {
  id: number;
  pillarId: number;
  name: string;
  completionType: string;
  target: number | null;
  unit: string | null;
  flexibilityRule: string;
  importance: string;
  frequency: string;
  customDays: string | null;
  isWeekendTask: boolean;
  basePoints: number;
}

interface TaskGroup {
  pillar: Pillar;
  tasks: Task[];
}

const COMPLETION_TYPES = [
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'count', label: 'Count' },
  { value: 'duration', label: 'Duration (min)' },
  { value: 'numeric', label: 'Numeric' },
  { value: 'percentage', label: 'Percentage' },
];

const IMPORTANCE_OPTIONS = [
  { value: 'high', label: 'High', color: 'text-red-600' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-600' },
  { value: 'low', label: 'Low', color: 'text-gray-600' },
];

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom Days' },
];

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function TasksPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form, setForm] = useState({
    pillarId: 0,
    name: '',
    completionType: 'checkbox',
    target: '',
    unit: '',
    importance: 'medium',
    frequency: 'daily',
    customDays: [] as number[],
    isWeekendTask: false,
    basePoints: '10',
    flexibilityRule: 'must_today',
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (session?.user?.id) {
      fetchData();
    }
  }, [session, status]);

  const fetchData = async () => {
    try {
      const [tasksRes, pillarsRes] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/pillars'),
      ]);
      if (tasksRes.ok) setGroups(await tasksRes.json());
      if (pillarsRes.ok) {
        const p = await pillarsRes.json();
        setPillars(p);
        if (p.length > 0 && form.pillarId === 0) {
          setForm(prev => ({ ...prev, pillarId: p[0].id }));
        }
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.pillarId) return;

    const body: Record<string, unknown> = {
      pillarId: form.pillarId,
      name: form.name,
      completionType: form.completionType,
      importance: form.importance,
      frequency: form.frequency,
      isWeekendTask: form.isWeekendTask,
      basePoints: parseFloat(form.basePoints) || 10,
      flexibilityRule: form.flexibilityRule,
    };

    if (form.target) body.target = parseFloat(form.target);
    if (form.unit) body.unit = form.unit;
    if (form.frequency === 'custom') body.customDays = JSON.stringify(form.customDays);

    try {
      if (editingTask) {
        await fetch(`/api/tasks/${editingTask.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      await fetchData();
      resetForm();
    } catch (error) {
      console.error("Failed to save task:", error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      await fetchData();
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingTask(null);
    setForm({
      pillarId: pillars[0]?.id || 0,
      name: '',
      completionType: 'checkbox',
      target: '',
      unit: '',
      importance: 'medium',
      frequency: 'daily',
      customDays: [],
      isWeekendTask: false,
      basePoints: '10',
      flexibilityRule: 'must_today',
    });
  };

  const startEdit = (task: Task) => {
    setEditingTask(task);
    setForm({
      pillarId: task.pillarId,
      name: task.name,
      completionType: task.completionType,
      target: task.target?.toString() || '',
      unit: task.unit || '',
      importance: task.importance,
      frequency: task.frequency,
      customDays: task.customDays ? JSON.parse(task.customDays) : [],
      isWeekendTask: task.isWeekendTask,
      basePoints: task.basePoints.toString(),
      flexibilityRule: task.flexibilityRule,
    });
    setShowForm(true);
  };

  const toggleCustomDay = (day: number) => {
    setForm(prev => ({
      ...prev,
      customDays: prev.customDays.includes(day)
        ? prev.customDays.filter(d => d !== day)
        : [...prev.customDays, day],
    }));
  };

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
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">Tasks</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Manage your daily actions</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { resetForm(); setShowForm(true); }}
            disabled={pillars.length === 0}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
          >
            <FaPlus /> Add Task
          </motion.button>
        </div>

        {pillars.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="text-lg mb-2">Create pillars first</p>
            <p className="text-sm">You need at least one pillar before adding tasks</p>
          </div>
        )}

        {/* Task Groups by Pillar */}
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.pillar.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div
                className="px-4 py-3 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700"
                style={{ borderLeftWidth: 4, borderLeftColor: group.pillar.color }}
              >
                <span className="text-lg">{group.pillar.emoji}</span>
                <h3 className="font-semibold text-gray-900 dark:text-white">{group.pillar.name}</h3>
                <span className="text-xs text-gray-500 ml-auto">{group.tasks.length} tasks</span>
              </div>

              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {group.tasks.map((task: Task) => (
                  <div key={task.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white text-sm">{task.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          task.importance === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          task.importance === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {task.importance}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        <span className="capitalize">{task.completionType}</span>
                        {task.target && <span>Target: {task.target} {task.unit || ''}</span>}
                        <span className="capitalize">{task.frequency}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEdit(task)}
                        className="p-1.5 text-blue-500 hover:text-blue-700"
                      >
                        <FaEdit className="text-sm" />
                      </button>
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="p-1.5 text-red-400 hover:text-red-600"
                      >
                        <FaTrash className="text-sm" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

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
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {editingTask ? 'Edit Task' : 'New Task'}
                  </h2>
                  <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <FaTimes />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Pillar */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pillar</label>
                    <select
                      value={form.pillarId}
                      onChange={e => setForm({ ...form, pillarId: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {pillars.map(p => (
                        <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Task Name</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="e.g., Gym session"
                    />
                  </div>

                  {/* Completion Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Completion Type</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {COMPLETION_TYPES.map(ct => (
                        <button
                          key={ct.value}
                          onClick={() => setForm({ ...form, completionType: ct.value })}
                          className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                            form.completionType === ct.value
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                              : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {ct.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Target & Unit (for non-checkbox types) */}
                  {form.completionType !== 'checkbox' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target</label>
                        <input
                          type="number"
                          value={form.target}
                          onChange={e => setForm({ ...form, target: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="e.g., 8"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit</label>
                        <input
                          type="text"
                          value={form.unit}
                          onChange={e => setForm({ ...form, unit: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="e.g., glasses"
                        />
                      </div>
                    </div>
                  )}

                  {/* Importance */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Importance</label>
                    <div className="flex gap-2">
                      {IMPORTANCE_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setForm({ ...form, importance: opt.value })}
                          className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                            form.importance === opt.value
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 font-bold'
                              : 'border-gray-300 dark:border-gray-600'
                          } text-gray-700 dark:text-gray-300`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Frequency */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Frequency</label>
                    <div className="flex gap-2">
                      {FREQUENCY_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setForm({ ...form, frequency: opt.value })}
                          className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                            form.frequency === opt.value
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 font-bold'
                              : 'border-gray-300 dark:border-gray-600'
                          } text-gray-700 dark:text-gray-300`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Days */}
                  {form.frequency === 'custom' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Days</label>
                      <div className="flex gap-1">
                        {DAYS_OF_WEEK.map((day, idx) => (
                          <button
                            key={idx}
                            onClick={() => toggleCustomDay(idx)}
                            className={`flex-1 py-2 text-xs rounded-lg border transition-colors ${
                              form.customDays.includes(idx)
                                ? 'border-blue-500 bg-blue-500 text-white'
                                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Weekend Task */}
                  <div
                    onClick={() => setForm({ ...form, isWeekendTask: !form.isWeekendTask })}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">Weekend-only task</span>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      form.isWeekendTask ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {form.isWeekendTask && <FaCheck className="text-xs" />}
                    </div>
                  </div>

                  {/* Base Points */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Base Points</label>
                    <input
                      type="number"
                      value={form.basePoints}
                      onChange={e => setForm({ ...form, basePoints: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSubmit}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                    >
                      <FaCheck /> {editingTask ? 'Update' : 'Create'}
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
