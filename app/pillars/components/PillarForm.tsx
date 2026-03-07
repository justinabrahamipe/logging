"use client";

import { useState } from "react";
import { FaCheck } from "react-icons/fa";

interface Pillar {
  id: number;
  name: string;
  emoji: string;
  color: string;
  weight: number;
  description: string | null;
}

const EMOJI_OPTIONS = [
  "\u{1F4AA}", "\u{1F4BC}", "\u{1F680}", "\u{1F3E0}", "\u{1F4D6}",
  "\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}", "\u{1F3AF}", "\u{1F4B0}", "\u{1F9E0}", "\u{1F3A8}",
  "\u{1F3CB}\u{FE0F}", "\u{1F4CC}", "\u{2B50}", "\u{2764}\u{FE0F}", "\u{1F525}",
];
const COLOR_OPTIONS = [
  "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#84CC16",
];

export default function PillarForm({
  editingPillar,
  onCancel,
  onSave,
}: {
  editingPillar: Pillar | null;
  onCancel: () => void;
  onSave: (body: Record<string, unknown>, isEdit: boolean) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: editingPillar?.name || "",
    emoji: editingPillar?.emoji || "\u{1F4CC}",
    color: editingPillar?.color || "#3B82F6",
    weight: editingPillar?.weight || 0,
    description: editingPillar?.description || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onSave(form, !!editingPillar);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="e.g., Health & Fitness"
          autoFocus
        />
      </div>

      {/* Emoji + Color side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Emoji</label>
          <div className="flex flex-wrap gap-2">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => setForm({ ...form, emoji })}
                className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center ${
                  form.emoji === emoji
                    ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "bg-gray-100 dark:bg-gray-700"
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
            {COLOR_OPTIONS.map((color) => (
              <button
                key={color}
                onClick={() => setForm({ ...form, color })}
                className={`w-8 h-8 rounded-full ${
                  form.color === color ? "ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-800" : ""
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Weight + Description */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Weight (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            value={form.weight}
            onChange={(e) => setForm({ ...form, weight: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Optional description"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium flex items-center gap-2"
        >
          <FaCheck /> {editingPillar ? "Update" : "Create"}
        </button>
      </div>
    </div>
  );
}
