"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FaArrowLeft } from "react-icons/fa";
import TaskForm from "../components/TaskForm";

interface Pillar {
  id: number;
  name: string;
  emoji: string;
  color: string;
}

interface Outcome {
  id: number;
  pillarId: number | null;
  name: string;
  goalType: string;
}

export default function NewTaskPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      setLoading(false);
      return;
    }
    if (session?.user?.id) {
      Promise.all([
        fetch("/api/pillars").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/outcomes").then((r) => (r.ok ? r.json() : [])),
      ]).then(([p, o]) => {
        setPillars(p);
        setOutcomes(
          o.map((x: Outcome & { pillarId: number | null; goalType: string }) => ({
            id: x.id,
            pillarId: x.pillarId,
            name: x.name,
            goalType: x.goalType || "outcome",
          }))
        );
        setLoading(false);
      });
    }
  }, [session, status, router]);

  const handleSave = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      router.push("/tasks");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/tasks")}
          className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
        >
          <FaArrowLeft />
        </button>
        <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white">New Task</h1>
      </div>

      <TaskForm
        editingTask={null}
        pillars={pillars}
        outcomes={outcomes}
        onCancel={() => router.push("/tasks")}
        onSave={handleSave}
        disabled={status !== "authenticated"}
      />
    </div>
  );
}
