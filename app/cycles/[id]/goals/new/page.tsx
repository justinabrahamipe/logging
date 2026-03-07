"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { FaArrowLeft, FaCheck } from "react-icons/fa";

interface Outcome {
  id: number;
  name: string;
}

export default function NewCycleGoalPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const cycleId = params.id as string;

  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", targetValue: "", unit: "", linkedOutcomeId: "" });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (session?.user?.id) {
      fetch("/api/outcomes")
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          setOutcomes(data.map((o: { id: number; name: string }) => ({ id: o.id, name: o.name })));
          setLoading(false);
        });
    }
  }, [session, status, router]);

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.targetValue || !form.unit.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/cycles/${cycleId}/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          targetValue: parseFloat(form.targetValue),
          unit: form.unit,
          linkedOutcomeId: form.linkedOutcomeId ? parseInt(form.linkedOutcomeId) : null,
        }),
      });
      if (res.ok) {
        router.push("/cycles");
      }
    } finally {
      setSaving(false);
    }
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
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/cycles")}
          className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <FaArrowLeft />
        </button>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">New Goal</h1>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="e.g., LeetCode problems"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Value</label>
            <input
              type="number"
              step="any"
              value={form.targetValue}
              onChange={(e) => setForm({ ...form, targetValue: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g., 60"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit</label>
            <input
              type="text"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g., problems"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Link to Outcome (optional)
          </label>
          <select
            value={form.linkedOutcomeId}
            onChange={(e) => setForm({ ...form, linkedOutcomeId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">None</option>
            {outcomes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
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
