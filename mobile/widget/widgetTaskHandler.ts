import React from "react";
import * as SecureStore from "expo-secure-store";
import { registerWidgetTaskHandler, requestWidgetUpdate, WidgetTaskHandler } from "react-native-android-widget";
import { Task, TodayResponse } from "../src/api/types";
import { api, setSession } from "../src/api/client";
import { API_KEY_KEY, BASE_URL_KEY } from "../src/context/AuthContext";
import * as offlineTaskOps from "../src/offline/offlineTaskOps";
import * as taskCache from "../src/offline/taskCache";
import { darkTheme, lightTheme } from "../src/theme";
import { todayString } from "../src/utils/date";
import { LogWidget } from "./LogWidget";
import { TaskWidget, WidgetTask } from "./TaskWidget";

const TASK_WIDGET_NAME = "TaskWidget";

// This handler can run as a headless JS task Android spins up just to redraw the
// widget (periodic update, resize, new-day rollover) — that path never mounts
// AuthProvider, so the in-memory session in api/client.ts starts out empty. Hydrate
// it from SecureStore directly, same keys AuthProvider uses. Cheap and idempotent,
// safe to call on every invocation.
async function ensureSession(): Promise<boolean> {
  const [storedUrl, storedKey] = await Promise.all([
    SecureStore.getItemAsync(BASE_URL_KEY),
    SecureStore.getItemAsync(API_KEY_KEY),
  ]);
  if (storedUrl && storedKey) {
    setSession(storedUrl, storedKey);
    return true;
  }
  return false;
}

// justCompletedId: the task the tap that triggered this render just finished, if any —
// kept in the list (instead of filtered out like every other completed task) so it can
// render checked for one frame rather than the row silently vanishing. See TaskWidget.tsx.
function pendingTasks(data: TodayResponse | null, justCompletedId?: number): { overdue: WidgetTask[]; today: WidgetTask[] } {
  if (!data) return { overdue: [], today: [] };
  const keep = (t: Task) => !t.skipped && (!t.completed || t.id === justCompletedId);
  const mark = (t: Task): WidgetTask => (t.id === justCompletedId && t.completed ? { ...t, justCompleted: true } : t);
  const today = data.groups.flatMap((g) => g.tasks).filter(keep).map(mark);
  const overdue = data.overdueTasks.filter(keep).map(mark);
  return { overdue, today };
}

// Simple done/total across today's scheduled tasks (skipped tasks don't count against
// you). Not the same weighted metric as the app's Action Score — the widget only has
// the cached task list, not score history — but a fair proxy for "how's today going".
function todayCompletionPct(data: TodayResponse | null): number {
  if (!data) return 0;
  const all = data.groups.flatMap((g) => g.tasks).filter((t) => !t.skipped);
  if (all.length === 0) return 0;
  const done = all.filter((t) => t.completed).length;
  return (done / all.length) * 100;
}

function findTask(data: TodayResponse | null, taskId: number): Task | undefined {
  if (!data) return undefined;
  return (
    data.groups.flatMap((g) => g.tasks).find((t) => t.id === taskId) ??
    data.overdueTasks.find((t) => t.id === taskId) ??
    data.noDateTasks.find((t) => t.id === taskId)
  );
}

// Pulls fresh data for today straight from the API instead of trusting whatever's
// cached — the cache is only ever written when the main app is opened, so without
// this, a widget nobody has opened the app for since midnight would keep showing
// yesterday's (now stale/empty) task list. Falls back to cache if offline/signed out.
// Writes through setForDateSilent (not setForDate) since this function IS the thing
// that would react to setForDate's "cache changed" notification — using the notifying
// version here would refresh itself forever.
async function refreshTodayData(): Promise<TodayResponse | null> {
  const date = todayString();
  const signedIn = await ensureSession();
  if (signedIn) {
    try {
      const fresh = await api.get<TodayResponse>(`/api/tasks?date=${date}`);
      await taskCache.setForDateSilent(date, fresh);
      return fresh;
    } catch {
      // offline, signed-out-server-side, etc. — fall through to whatever's cached
    }
  }
  return taskCache.getForDate(date);
}

async function renderTaskWidget(justCompletedId?: number): Promise<{ light: React.JSX.Element; dark: React.JSX.Element }> {
  const data = await refreshTodayData();
  const { overdue, today } = pendingTasks(data, justCompletedId);
  const todayPct = todayCompletionPct(data);
  return {
    light: React.createElement(TaskWidget, { theme: lightTheme, overdue, today, todayPct }),
    dark: React.createElement(TaskWidget, { theme: darkTheme, overdue, today, todayPct }),
  };
}

// Static — both buttons are OPEN_URI deep links handled natively (see LogWidget.tsx),
// there's no data to fetch and nothing to react to on click.
function renderLogWidget(): { light: React.JSX.Element; dark: React.JSX.Element } {
  return {
    light: React.createElement(LogWidget, { theme: lightTheme }),
    dark: React.createElement(LogWidget, { theme: darkTheme }),
  };
}

export const widgetTaskHandler: WidgetTaskHandler = async ({ widgetInfo, widgetAction, clickAction, clickActionData, renderWidget }) => {
  if (widgetInfo.widgetName === "LogWidget") {
    renderWidget(renderLogWidget());
    return;
  }

  let justCompletedId: number | undefined;

  if (widgetAction === "WIDGET_CLICK") {
    await ensureSession();
    const taskId = clickActionData?.taskId as number | undefined;
    const date = todayString();

    if (clickAction === "COMPLETE_TASK" && typeof taskId === "number") {
      const result = await offlineTaskOps.tryComplete(taskId, date, true, 1);
      // Patch the local cache so the very next render (below) shows the change —
      // tryComplete only writes through the API/queue, it never touches the cache.
      if (result.ok || result.queued) {
        await taskCache.patchTaskSilent(date, taskId, { completed: true, value: 1 });
        justCompletedId = taskId;
      }
    } else if (clickAction === "INCREMENT_TASK" && typeof taskId === "number") {
      const data = await taskCache.getForDate(date);
      const task = findTask(data, taskId);
      if (task) {
        const isLimit = task.flexibilityRule === "limit_avoid";
        const newValue = Math.max(0, task.value + 1);
        const completed = isLimit ? task.completed : task.target ? newValue >= task.target : newValue > 0;
        const result = await offlineTaskOps.tryComplete(taskId, date, completed, newValue);
        if (result.ok || result.queued) {
          await taskCache.patchTaskSilent(date, taskId, { completed, value: newValue });
          if (completed) justCompletedId = taskId;
        }
      }
    } else if (clickAction === "TOGGLE_TIMER" && typeof taskId === "number") {
      const data = await taskCache.getForDate(date);
      const task = findTask(data, taskId);
      if (task) {
        if (task.timerStartedAt != null) {
          // Stop: same elapsed-minutes math as the app's timerToggle/restoreTimers —
          // value already holds minutes logged before this run, timerStartedAt is when
          // this run began.
          const elapsedSec = (task.value || 0) * 60 + Math.max(0, Math.floor((Date.now() - task.timerStartedAt) / 1000));
          const minutes = Math.round(elapsedSec / 60);
          const isLimit = task.flexibilityRule === "limit_avoid";
          const completed = isLimit ? task.completed : task.target ? elapsedSec >= task.target * 60 : minutes > 0;
          await api.post("/api/tasks/timer", { taskId, action: "stop" }).catch(() => {});
          const result = await offlineTaskOps.tryComplete(taskId, date, completed, minutes);
          if (result.ok || result.queued) {
            await taskCache.patchTaskSilent(date, taskId, { completed, value: minutes, timerStartedAt: null });
            if (completed) justCompletedId = taskId;
          }
        } else {
          // Start: best-effort like the app's saveTimerToDb — not queued offline, since
          // a start that silently didn't take just means tapping Start again works.
          const startedAt = Date.now();
          await api.post("/api/tasks/timer", { taskId, action: "start" }).catch(() => {});
          await taskCache.patchTaskSilent(date, taskId, { timerStartedAt: startedAt });
        }
      }
    }
  }
  renderWidget(await renderTaskWidget(justCompletedId));
};

export function initWidget(): void {
  registerWidgetTaskHandler(widgetTaskHandler);
  taskCache.subscribeDateChanges((date) => {
    if (date !== todayString()) return;
    requestWidgetUpdate({ widgetName: TASK_WIDGET_NAME, renderWidget: () => renderTaskWidget() });
  });
}
