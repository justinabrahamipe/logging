"use client";

import { FaEdit, FaTrash } from "react-icons/fa";
import { getCompletionTypeLabel } from "@/lib/constants";
import type { Task, Outcome } from "@/lib/types";
import type { EnrichedTask } from "./TaskItem";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

interface TaskGroupProps {
  tasks: EnrichedTask[];
  goalsList: Outcome[];
  router: AppRouterInstance;
  handleDelete: (id: number) => void;
  getScheduleLabel: (task: Task) => string;
}

export default function TaskGroup({
  tasks,
  router,
  handleDelete,
  getScheduleLabel,
}: TaskGroupProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
        <p className="text-sm">No scheduled (recurring) tasks</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.5rem' }}>
      {tasks.map(task => (
        <div
          key={task.id}
          className="rounded-lg px-3 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-600 transition-all"
          style={{ borderLeftWidth: 3, borderLeftColor: task._pillarColor }}
        >
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold leading-snug text-zinc-900 dark:text-white">
                {task.name}
              </h3>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0">{task._pillarEmoji} {task._pillarName}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  {getScheduleLabel(task)}
                </span>
                <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                  {getCompletionTypeLabel(task.completionType)}
                </span>
                {task.target && (
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Target: {task.target}{task.unit ? ` ${task.unit}` : ''}
                  </span>
                )}
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                  {task.basePoints}pts
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => router.push(`/tasks/${task.id}/edit`)}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700"
                title="Edit"
              >
                <FaEdit className="text-xs" />
              </button>
              <button
                onClick={() => handleDelete(task.id)}
                className="p-1.5 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                title="Delete"
              >
                <FaTrash className="text-xs" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
