"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FaArrowLeft, FaCheck } from "react-icons/fa";
import { calculateEndDate } from "@/lib/twelve-week-scoring";

export default function NewCyclePage() {
  const { status } = useSession();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "", vision: "", theme: "" });
  const [saving, setSaving] = useState(false);

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.startDate) return;
    setSaving(true);
    try {
      const res = await fetch("/api/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          startDate: form.startDate,
          endDate: form.endDate || null,
          vision: form.vision || null,
          theme: form.theme || null,
        }),
      });
      if (res.ok) {
        router.push("/cycles");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/cycles")}
          className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <FaArrowLeft />
        </button>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">New Cycle</h1>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="e.g., Q1 2026 Transformation"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => {
                const start = e.target.value;
                const autoEnd = start ? calculateEndDate(start) : "";
                setForm({ ...form, startDate: start, endDate: form.endDate || autoEnd });
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vision (optional)</label>
          <textarea
            value={form.vision}
            onChange={(e) => setForm({ ...form, vision: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            placeholder="Your vision for this cycle..."
            rows={2}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Theme (optional)</label>
          <input
            type="text"
            value={form.theme}
            onChange={(e) => setForm({ ...form, theme: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="e.g., Deep Focus"
          />
        </div>

        <div className="flex gap-3 pt-2 justify-end">
          <button
            onClick={() => router.push("/cycles")}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium flex items-center gap-2"
          >
            <FaCheck /> Create
          </button>
        </div>
      </div>
    </div>
  );
}
