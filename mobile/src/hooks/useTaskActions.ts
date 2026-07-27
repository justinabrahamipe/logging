import { useState } from "react";
import { api, ApiRequestError, isOfflineError } from "../api/client";
import { Task } from "../api/types";
import * as offlineTaskOps from "../offline/offlineTaskOps";
import { addDays, todayString } from "../utils/date";

type OfflineContext = { date: string };

/** Shared task-mutation logic for any screen rendering tasks (TaskListView, goal detail, etc). Mirrors app/tasks/hooks/useTasksPage.ts on the web. */
export function useTaskActions(
  applyPatch: (taskId: number, patch: Partial<Task>) => void,
  onError?: (message: string) => void,
  onRemoved?: (taskId: number) => void,
  onDuplicated?: () => void,
  offline?: OfflineContext,
) {
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());

  const setBusy = (taskId: number, busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  };

  const complete = async (task: Task, completed: boolean, value: number) => {
    setBusy(task.id, true);
    applyPatch(task.id, { completed, value });
    if (offline) {
      const result = await offlineTaskOps.tryComplete(task.id, offline.date, completed, value);
      if (!result.ok && !result.queued) {
        applyPatch(task.id, { completed: task.completed, value: task.value });
        onError?.(result.message);
      }
      setBusy(task.id, false);
      return;
    }
    try {
      await api.post("/api/tasks/complete", { taskId: task.id, date: task.date, completed, value });
    } catch (err) {
      applyPatch(task.id, { completed: task.completed, value: task.value });
      onError?.(err instanceof ApiRequestError ? err.message : "Couldn't update task.");
    } finally {
      setBusy(task.id, false);
    }
  };

  const checkboxToggle = (task: Task) => {
    const nextCompleted = !task.completed;
    complete(task, nextCompleted, nextCompleted ? 1 : 0);
  };

  const countChange = (task: Task, delta: number) => {
    const newValue = Math.max(0, task.value + delta);
    const isLimit = task.flexibilityRule === "limit_avoid";
    const completed = isLimit ? task.completed : task.target ? newValue >= task.target : newValue > 0;
    complete(task, completed, newValue);
  };

  const toggleSkip = async (task: Task) => {
    const nextSkipped = !task.skipped;
    setBusy(task.id, true);
    applyPatch(task.id, { skipped: nextSkipped });
    if (offline) {
      const result = await offlineTaskOps.trySkip(task.id, offline.date, nextSkipped);
      if (!result.ok && !result.queued) {
        applyPatch(task.id, { skipped: task.skipped });
        onError?.(result.message);
      }
      setBusy(task.id, false);
      return;
    }
    try {
      await api.post("/api/tasks/skip", { taskId: task.id, skipped: nextSkipped, date: task.date });
    } catch (err) {
      applyPatch(task.id, { skipped: task.skipped });
      onError?.(err instanceof ApiRequestError ? err.message : "Couldn't update task.");
    } finally {
      setBusy(task.id, false);
    }
  };

  const reschedule = async (task: Task, deltaDays: number) => {
    if (!task.date) return;
    const newDate = addDays(task.date, deltaDays);
    setBusy(task.id, true);
    if (offline) {
      // Use the currently-viewed date (not task.date) as the cache bucket: overdue/no-date tasks only
      // ever appear inside *today's* cached response, nested in overdueTasks/noDateTasks.
      const result = await offlineTaskOps.tryReschedule(task.id, offline.date, newDate, "reschedule");
      if (!result.ok && !result.queued) {
        onError?.(result.message);
      } else {
        onRemoved?.(task.id);
      }
      setBusy(task.id, false);
      return;
    }
    try {
      await api.put(`/api/tasks/${task.id}`, { startDate: newDate });
      onRemoved?.(task.id);
    } catch (err) {
      onError?.(err instanceof ApiRequestError ? err.message : "Couldn't reschedule task.");
    } finally {
      setBusy(task.id, false);
    }
  };

  const scheduleToday = async (task: Task) => {
    setBusy(task.id, true);
    if (offline) {
      const result = await offlineTaskOps.tryReschedule(task.id, offline.date, todayString(), "scheduleToday");
      if (!result.ok && !result.queued) {
        onError?.(result.message);
      } else {
        onRemoved?.(task.id);
      }
      setBusy(task.id, false);
      return;
    }
    try {
      await api.put(`/api/tasks/${task.id}`, { startDate: todayString() });
      onRemoved?.(task.id);
    } catch (err) {
      onError?.(err instanceof ApiRequestError ? err.message : "Couldn't schedule task.");
    } finally {
      setBusy(task.id, false);
    }
  };

  const duplicate = async (task: Task) => {
    setBusy(task.id, true);
    try {
      const raw = await api.get<Task & { customDays?: string | null; repeatInterval?: number | null; endDate?: string | null }>(
        `/api/tasks/${task.id}`,
      );
      await api.post("/api/tasks", {
        name: `${raw.name} (copy)`,
        pillarId: raw.pillarId,
        completionType: raw.completionType,
        flexibilityRule: raw.flexibilityRule,
        frequency: raw.frequency,
        customDays: raw.customDays ?? null,
        repeatInterval: raw.repeatInterval ?? null,
        basePoints: raw.basePoints,
        startDate: raw.date,
        endDate: raw.endDate ?? null,
        target: raw.target,
        unit: raw.unit,
        limitValue: raw.limitValue,
        description: raw.description ?? null,
      });
      onDuplicated?.();
    } catch (err) {
      if (offline && isOfflineError(err)) {
        onError?.("Duplicating a task needs a connection.");
      } else {
        onError?.(err instanceof ApiRequestError ? err.message : "Couldn't duplicate task.");
      }
    } finally {
      setBusy(task.id, false);
    }
  };

  const remove = async (task: Task) => {
    setBusy(task.id, true);
    if (offline) {
      const result = await offlineTaskOps.tryRemove(task.id, offline.date);
      if (!result.ok && !result.queued) {
        onError?.(result.message);
      } else {
        onRemoved?.(task.id);
      }
      setBusy(task.id, false);
      return;
    }
    try {
      await api.delete(`/api/tasks/${task.id}`);
      onRemoved?.(task.id);
    } catch (err) {
      onError?.(err instanceof ApiRequestError ? err.message : "Couldn't delete task.");
    } finally {
      setBusy(task.id, false);
    }
  };

  return { busyIds, checkboxToggle, countChange, toggleSkip, reschedule, scheduleToday, duplicate, remove };
}
