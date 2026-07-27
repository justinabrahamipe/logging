"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { FaArrowLeft } from "react-icons/fa";
import TaskForm from "../../components/TaskForm";
import type { Pillar, Task, Goal } from "@/lib/types";

export default function EditTaskPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [task, setTask] = useState<Task | null>(null);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (session?.user?.id) {
      Promise.all([
        fetch(`/api/tasks/${id}`).then((r) => (r.ok ? r.json() : null)),
        fetch("/api/pillars").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/goals").then((r) => (r.ok ? r.json() : [])),
      ]).then(async ([t, p, o]) => {
        // Map task instance `date` to `startDate` for the form
        if (t && t.date && !t.startDate) {
          t.startDate = t.date;
        }
        // If this is a task instance, merge schedule data for frequency/repeat info
        if (t && t.scheduleId && !t.frequency) {
          try {
            const schedRes = await fetch(`/api/tasks/${t.scheduleId}?type=schedule`);
            if (schedRes.ok) {
              const sched = await schedRes.json();
              t.frequency = sched.frequency;
              t.customDays = sched.customDays;
              t.repeatInterval = sched.repeatInterval;
              t.endDate = sched.endDate;
            }
          } catch { /* ignore */ }
        }
        // Default frequency for adhoc/goal-linked tasks without a schedule
        if (t && !t.frequency) {
          t.frequency = "adhoc";
        }
        setTask(t);
        setPillars(p);
        setGoals(o.map((g: Goal & { pillarEmoji?: string; pillarName?: string }) => ({
          id: g.id, name: g.name, goalType: g.goalType,
          pillarEmoji: g.pillarEmoji, pillarName: g.pillarName,
          pillarId: g.pillarId, startDate: g.startDate, targetDate: g.targetDate,
        })));
        setLoading(false);
      });
    }
  }, [session, status, router, id]);

  const handleSave = async (body: Record<string, unknown>) => {
    // Use scheduleId for the PUT if available, so the schedule update path
    // handles all fields and propagates changes to future task instances
    const updateId = task?.scheduleId || id;
    const res = await fetch(`/api/tasks/${updateId}`, {
      method: "PUT",
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

  if (!task) {
    return (
      <div className="container mx-auto px-4 py-4 md:py-8 max-w-4xl">
        <p className="text-zinc-500 dark:text-zinc-400">Task not found.</p>
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
        <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white">Edit Task</h1>
      </div>

      <TaskForm
        editingTask={task}
        pillars={pillars}
        goals={goals}
        onCancel={() => router.push("/tasks")}
        onSave={handleSave}
      />
    </div>
  );
}
