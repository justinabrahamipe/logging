"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { FaArrowLeft } from "react-icons/fa";
import { Outcome, Pillar, CycleOption } from "../../types";
import GoalForm from "../../components/GoalForm";

export default function EditGoalPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [cycles, setCycles] = useState<CycleOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (session?.user?.id) {
      Promise.all([
        fetch("/api/outcomes").then((r) => r.ok ? r.json() : []),
        fetch("/api/pillars").then((r) => r.ok ? r.json() : []),
        fetch("/api/cycles").then((r) => r.ok ? r.json() : []),
      ]).then(([outcomes, p, c]) => {
        const found = outcomes.find((o: Outcome) => String(o.id) === id);
        setOutcome(found || null);
        setPillars(p);
        setCycles(c);
        setLoading(false);
      });
    }
  }, [session, status, router, id]);

  const handleSave = async (payload: Record<string, unknown>) => {
    const res = await fetch(`/api/outcomes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      router.push("/goals");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-600"></div>
      </div>
    );
  }

  if (!outcome) {
    return (
      <div className="container mx-auto px-4 py-4 md:py-8 max-w-4xl">
        <p className="text-zinc-500 dark:text-zinc-400">Goal not found.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/goals")}
          className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
        >
          <FaArrowLeft />
        </button>
        <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white">Edit Goal</h1>
      </div>

      <GoalForm
        editingOutcome={outcome}
        pillars={pillars}
        cycles={cycles}
        onCancel={() => router.push("/goals")}
        onSave={handleSave}
      />
    </div>
  );
}
