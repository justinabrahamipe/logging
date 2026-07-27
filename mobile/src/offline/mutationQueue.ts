import { getJSON, setJSON } from "./storage";

const KEY = "grindconsole.offline.mutationQueue";

export type PendingMutation =
  | { id: string; kind: "create"; tempId: number; date: string; body: Record<string, unknown> }
  | { id: string; kind: "edit"; taskId: number; body: Record<string, unknown> }
  | { id: string; kind: "complete"; taskId: number; date: string; completed: boolean; value: number }
  | { id: string; kind: "skip"; taskId: number; date: string; skipped: boolean }
  | { id: string; kind: "reschedule"; taskId: number; fromDate: string; toDate: string }
  | { id: string; kind: "scheduleToday"; taskId: number; fromDate: string; toDate: string }
  | { id: string; kind: "remove"; taskId: number; date: string };

type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never;
type NewMutation = DistributiveOmit<PendingMutation, "id">;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const changeListeners = new Set<() => void>();

/** Notified after every queue mutation, so any screen can keep a "pending sync" indicator current. */
export function subscribeChanges(cb: () => void): () => void {
  changeListeners.add(cb);
  return () => changeListeners.delete(cb);
}

async function getQueue(): Promise<PendingMutation[]> {
  return (await getJSON<PendingMutation[]>(KEY)) ?? [];
}

async function setQueue(queue: PendingMutation[]): Promise<void> {
  await setJSON(KEY, queue);
  changeListeners.forEach((cb) => cb());
}

export async function getAll(): Promise<PendingMutation[]> {
  return getQueue();
}

export async function removeById(id: string): Promise<void> {
  const queue = await getQueue();
  await setQueue(queue.filter((m) => m.id !== id));
}

/** Rewrites every queued item referencing a temp id (from an offline create) to the real server id. */
export async function remapTaskId(oldId: number, newId: number): Promise<void> {
  const queue = await getQueue();
  const remapped = queue.map((m) => {
    if ("taskId" in m && m.taskId === oldId) return { ...m, taskId: newId };
    return m;
  });
  await setQueue(remapped);
}

export async function getPendingTaskIds(): Promise<Set<number>> {
  const queue = await getQueue();
  return new Set(queue.map((m) => (m.kind === "create" ? m.tempId : m.taskId)));
}

export async function hasPendingForDate(date: string): Promise<boolean> {
  const queue = await getQueue();
  return queue.some((m) => {
    if (m.kind === "create") return m.date === date;
    if (m.kind === "reschedule" || m.kind === "scheduleToday") return m.fromDate === date || m.toDate === date;
    if (m.kind === "edit") return false;
    return m.date === date;
  });
}

export async function enqueue(mutation: NewMutation): Promise<void> {
  const queue = await getQueue();

  // A task created offline that's then deleted before ever syncing: drop both, no network round trip needed.
  if (mutation.kind === "remove" && mutation.taskId < 0) {
    const createIndex = queue.findIndex((m) => m.kind === "create" && m.tempId === mutation.taskId);
    if (createIndex !== -1) {
      await setQueue(queue.filter((_, i) => i !== createIndex));
      return;
    }
  }

  // A task created offline that's edited/completed/skipped/rescheduled before ever syncing:
  // merge straight into the still-queued create instead of appending a separate entry.
  if (mutation.kind !== "create" && "taskId" in mutation && mutation.taskId < 0) {
    const createIndex = queue.findIndex((m) => m.kind === "create" && m.tempId === mutation.taskId);
    if (createIndex !== -1) {
      const create = queue[createIndex] as Extract<PendingMutation, { kind: "create" }>;
      const patch: Record<string, unknown> = {};
      if (mutation.kind === "edit") Object.assign(patch, mutation.body);
      if (mutation.kind === "complete") Object.assign(patch, { completed: mutation.completed, value: mutation.value });
      if (mutation.kind === "skip") Object.assign(patch, { skipped: mutation.skipped });
      if (mutation.kind === "reschedule" || mutation.kind === "scheduleToday") Object.assign(patch, { startDate: mutation.toDate });
      const updatedCreate = { ...create, body: { ...create.body, ...patch }, date: (patch.startDate as string) ?? create.date };
      await setQueue(queue.map((m, i) => (i === createIndex ? updatedCreate : m)));
      return;
    }
  }

  await setQueue([...queue, { ...mutation, id: generateId() } as PendingMutation]);
}
