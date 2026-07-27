import { api, ApiRequestError, isOfflineError } from "../api/client";
import { Task } from "../api/types";
import * as mutationQueue from "./mutationQueue";
import * as taskCache from "./taskCache";
import { nextTempId } from "./tempId";
import { kick } from "./syncEngine";

export type OpResult = { ok: true } | { ok: false; queued: true } | { ok: false; queued: false; message: string };

function messageFor(err: unknown, fallback: string): string {
  return err instanceof ApiRequestError ? err.message : fallback;
}

export async function tryComplete(taskId: number, date: string, completed: boolean, value: number): Promise<OpResult> {
  try {
    await api.post("/api/tasks/complete", { taskId, date, completed, value });
    return { ok: true };
  } catch (err) {
    if (isOfflineError(err)) {
      await mutationQueue.enqueue({ kind: "complete", taskId, date, completed, value });
      kick();
      return { ok: false, queued: true };
    }
    return { ok: false, queued: false, message: messageFor(err, "Couldn't update task.") };
  }
}

export async function trySkip(taskId: number, date: string, skipped: boolean): Promise<OpResult> {
  try {
    await api.post("/api/tasks/skip", { taskId, skipped, date });
    return { ok: true };
  } catch (err) {
    if (isOfflineError(err)) {
      await mutationQueue.enqueue({ kind: "skip", taskId, date, skipped });
      kick();
      return { ok: false, queued: true };
    }
    return { ok: false, queued: false, message: messageFor(err, "Couldn't update task.") };
  }
}

export async function tryReschedule(
  taskId: number,
  fromDate: string,
  toDate: string,
  kind: "reschedule" | "scheduleToday",
): Promise<OpResult> {
  try {
    await api.put(`/api/tasks/${taskId}`, { startDate: toDate });
    await taskCache.moveTaskToDate(taskId, fromDate, toDate, { date: toDate });
    return { ok: true };
  } catch (err) {
    if (isOfflineError(err)) {
      await taskCache.moveTaskToDate(taskId, fromDate, toDate, { date: toDate });
      await mutationQueue.enqueue({ kind, taskId, fromDate, toDate });
      kick();
      return { ok: false, queued: true };
    }
    return { ok: false, queued: false, message: messageFor(err, "Couldn't reschedule task.") };
  }
}

export async function tryRemove(taskId: number, date: string): Promise<OpResult> {
  try {
    await api.delete(`/api/tasks/${taskId}`);
    return { ok: true };
  } catch (err) {
    if (isOfflineError(err)) {
      await taskCache.removeTask(date, taskId);
      await mutationQueue.enqueue({ kind: "remove", taskId, date });
      kick();
      return { ok: false, queued: true };
    }
    return { ok: false, queued: false, message: messageFor(err, "Couldn't delete task.") };
  }
}

export async function tryEdit(taskId: number, date: string, patch: Partial<Task>, body: Record<string, unknown>): Promise<OpResult> {
  try {
    await api.put(`/api/tasks/${taskId}`, body);
    return { ok: true };
  } catch (err) {
    if (isOfflineError(err)) {
      await taskCache.patchTask(date, taskId, patch);
      await mutationQueue.enqueue({ kind: "edit", taskId, body });
      kick();
      return { ok: false, queued: true };
    }
    return { ok: false, queued: false, message: messageFor(err, "Couldn't save task.") };
  }
}

export type CreateResult =
  | { ok: true; id: number }
  | { ok: false; queued: true; tempId: number }
  | { ok: false; queued: false; message: string };

function buildOfflineTask(tempId: number, body: Record<string, unknown>): Task {
  return {
    id: tempId,
    userId: "",
    pillarId: (body.pillarId as number | null) ?? null,
    goalId: null,
    scheduleId: null,
    name: (body.name as string) ?? "",
    completionType: (body.completionType as Task["completionType"]) ?? "checkbox",
    target: (body.target as number | undefined) ?? null,
    unit: (body.unit as string | undefined) ?? null,
    basePoints: (body.basePoints as number) ?? 10,
    flexibilityRule: (body.flexibilityRule as Task["flexibilityRule"]) ?? "must_today",
    limitValue: (body.limitValue as number | undefined) ?? null,
    date: (body.startDate as string) || "",
    completed: false,
    value: 0,
    pointsEarned: 0,
    isHighlighted: false,
    skipped: false,
    timerStartedAt: null,
    dismissed: false,
    frequency: (body.frequency as string) ?? "adhoc",
    description: (body.description as string | undefined) ?? null,
    completion: null,
  };
}

export async function tryCreate(body: Record<string, unknown>): Promise<CreateResult> {
  const date = (body.startDate as string) || "";
  try {
    const created = await api.post<{ id: number }>("/api/tasks", body);
    return { ok: true, id: created.id };
  } catch (err) {
    if (isOfflineError(err)) {
      const tempId = await nextTempId();
      await taskCache.addTask(date, buildOfflineTask(tempId, body));
      await mutationQueue.enqueue({ kind: "create", tempId, date, body });
      kick();
      return { ok: false, queued: true, tempId };
    }
    return { ok: false, queued: false, message: messageFor(err, "Couldn't save task.") };
  }
}
