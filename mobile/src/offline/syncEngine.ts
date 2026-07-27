import { api, ApiRequestError } from "../api/client";
import * as mutationQueue from "./mutationQueue";
import type { PendingMutation } from "./mutationQueue";
import * as taskCache from "./taskCache";
import * as network from "./network";

const droppedListeners = new Set<(message: string) => void>();

export function onDropped(cb: (message: string) => void): () => void {
  droppedListeners.add(cb);
  return () => droppedListeners.delete(cb);
}

async function dispatch(mutation: PendingMutation): Promise<void> {
  switch (mutation.kind) {
    case "create": {
      const created = await api.post<{ id: number }>("/api/tasks", mutation.body);
      await mutationQueue.remapTaskId(mutation.tempId, created.id);
      await taskCache.replaceTaskId(mutation.date, mutation.tempId, created.id);
      return;
    }
    case "edit":
      await api.put(`/api/tasks/${mutation.taskId}`, mutation.body);
      return;
    case "complete":
      await api.post("/api/tasks/complete", {
        taskId: mutation.taskId,
        date: mutation.date,
        completed: mutation.completed,
        value: mutation.value,
      });
      return;
    case "skip":
      await api.post("/api/tasks/skip", { taskId: mutation.taskId, skipped: mutation.skipped, date: mutation.date });
      return;
    case "reschedule":
    case "scheduleToday":
      await api.put(`/api/tasks/${mutation.taskId}`, { startDate: mutation.toDate });
      await taskCache.moveTaskToDate(mutation.taskId, mutation.fromDate, mutation.toDate, { date: mutation.toDate });
      return;
    case "remove":
      await api.delete(`/api/tasks/${mutation.taskId}`);
      return;
  }
}

function describe(mutation: PendingMutation): string {
  switch (mutation.kind) {
    case "create": return "A task created offline";
    case "edit": return "A task edit";
    case "complete": return "A task completion";
    case "skip": return "A task skip";
    case "reschedule": case "scheduleToday": return "A task reschedule";
    case "remove": return "A task deletion";
  }
}

let draining = false;

export async function drainQueue(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    for (;;) {
      if (!network.isConnected()) return;
      const queue = await mutationQueue.getAll();
      if (queue.length === 0) return;

      const [item] = queue;
      try {
        await dispatch(item);
        await mutationQueue.removeById(item.id);
      } catch (err) {
        if (err instanceof ApiRequestError) {
          await mutationQueue.removeById(item.id);
          const message = `${describe(item)} couldn't be synced: ${err.message}`;
          droppedListeners.forEach((cb) => cb(message));
          continue;
        }
        // network error — stop, leave this item and the rest queued in order
        return;
      }
    }
  } finally {
    draining = false;
  }
}

export function kick(): void {
  drainQueue().catch(() => {});
}
