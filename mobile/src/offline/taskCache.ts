import { Task, TodayResponse } from "../api/types";
import { getJSON, setJSON } from "./storage";

function cacheKey(date: string): string {
  return `grindconsole.offline.taskCache.${date}`;
}

function emptyResponse(): TodayResponse {
  return { groups: [], noDateTasks: [], overdueTasks: [] };
}

export async function getForDate(date: string): Promise<TodayResponse | null> {
  return getJSON<TodayResponse>(cacheKey(date));
}

const dateChangeListeners = new Set<(date: string) => void>();

/** Notified after every write to a date's cache — lets the widget (or anything else) push a refresh without taskCache needing to know about it. */
export function subscribeDateChanges(cb: (date: string) => void): () => void {
  dateChangeListeners.add(cb);
  return () => dateChangeListeners.delete(cb);
}

export async function setForDate(date: string, data: TodayResponse): Promise<void> {
  await setJSON(cacheKey(date), data);
  dateChangeListeners.forEach((cb) => cb(date));
}

// Same as setForDate but skips the change notification. For callers that are about to
// render with this exact data themselves (the widget's own background refresh) — going
// through setForDate there would re-trigger their own "cache changed" subscription and
// refresh forever.
export async function setForDateSilent(date: string, data: TodayResponse): Promise<void> {
  await setJSON(cacheKey(date), data);
}

export function patchTaskIn(data: TodayResponse, taskId: number, patch: Partial<Task>): TodayResponse {
  const apply = (t: Task) => (t.id === taskId ? { ...t, ...patch } : t);
  return {
    groups: data.groups.map((g) => ({ ...g, tasks: g.tasks.map(apply) })),
    noDateTasks: data.noDateTasks.map(apply),
    overdueTasks: data.overdueTasks.map(apply),
  };
}

export function removeTaskIn(data: TodayResponse, taskId: number): TodayResponse {
  const strip = (arr: Task[]) => arr.filter((t) => t.id !== taskId);
  return {
    groups: data.groups.map((g) => ({ ...g, tasks: strip(g.tasks) })),
    noDateTasks: strip(data.noDateTasks),
    overdueTasks: strip(data.overdueTasks),
  };
}

export function addTaskIn(data: TodayResponse, task: Task): TodayResponse {
  if (!task.date) {
    return { ...data, noDateTasks: [...data.noDateTasks, task] };
  }
  if (data.groups.length === 0) {
    return { ...data, groups: [{ pillar: null, tasks: [task] }] };
  }
  return {
    ...data,
    groups: data.groups.map((g, i) => (i === 0 ? { ...g, tasks: [...g.tasks, task] } : g)),
  };
}

export async function patchTask(date: string, taskId: number, patch: Partial<Task>): Promise<void> {
  const data = (await getForDate(date)) ?? emptyResponse();
  await setForDate(date, patchTaskIn(data, taskId, patch));
}

// Same as patchTask but skips the change notification — see setForDateSilent.
export async function patchTaskSilent(date: string, taskId: number, patch: Partial<Task>): Promise<void> {
  const data = (await getForDate(date)) ?? emptyResponse();
  await setForDateSilent(date, patchTaskIn(data, taskId, patch));
}

export async function removeTask(date: string, taskId: number): Promise<void> {
  const data = await getForDate(date);
  if (!data) return;
  await setForDate(date, removeTaskIn(data, taskId));
}

export async function addTask(date: string, task: Task): Promise<void> {
  const data = (await getForDate(date)) ?? emptyResponse();
  await setForDate(date, addTaskIn(data, task));
}

export async function replaceTaskId(date: string, oldId: number, newId: number): Promise<void> {
  const data = await getForDate(date);
  if (!data) return;
  await setForDate(date, patchTaskIn(data, oldId, { id: newId }));
}

function findTask(data: TodayResponse, taskId: number): Task | null {
  return (
    data.groups.flatMap((g) => g.tasks).find((t) => t.id === taskId) ??
    data.noDateTasks.find((t) => t.id === taskId) ??
    data.overdueTasks.find((t) => t.id === taskId) ??
    null
  );
}

/** Moves a task from one date's cache bucket to another — the single place reschedule crosses date buckets. */
export async function moveTaskToDate(taskId: number, fromDate: string, toDate: string, patch: Partial<Task>): Promise<void> {
  const fromData = await getForDate(fromDate);
  if (!fromData) return;
  const task = findTask(fromData, taskId);
  if (!task) return;

  await setForDate(fromDate, removeTaskIn(fromData, taskId));

  const toData = (await getForDate(toDate)) ?? emptyResponse();
  const updated = { ...task, ...patch };
  await setForDate(toDate, addTaskIn(removeTaskIn(toData, taskId), updated));
}
