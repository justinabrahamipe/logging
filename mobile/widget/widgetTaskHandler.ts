import React from "react";
import { registerWidgetTaskHandler, requestWidgetUpdate, WidgetTaskHandler } from "react-native-android-widget";
import { Task, TodayResponse } from "../src/api/types";
import * as offlineTaskOps from "../src/offline/offlineTaskOps";
import * as taskCache from "../src/offline/taskCache";
import { darkTheme, lightTheme } from "../src/theme";
import { todayString } from "../src/utils/date";
import { TaskWidget } from "./TaskWidget";

const WIDGET_NAME = "TaskWidget";

function pendingTasks(data: TodayResponse | null): { overdue: Task[]; today: Task[] } {
  if (!data) return { overdue: [], today: [] };
  const today = data.groups.flatMap((g) => g.tasks).filter((t) => !t.completed && !t.skipped);
  const overdue = data.overdueTasks.filter((t) => !t.completed && !t.skipped);
  return { overdue, today };
}

async function render(): Promise<{ light: React.JSX.Element; dark: React.JSX.Element }> {
  const data = await taskCache.getForDate(todayString());
  const { overdue, today } = pendingTasks(data);
  return {
    light: React.createElement(TaskWidget, { theme: lightTheme, overdue, today }),
    dark: React.createElement(TaskWidget, { theme: darkTheme, overdue, today }),
  };
}

export const widgetTaskHandler: WidgetTaskHandler = async ({ widgetAction, clickAction, clickActionData, renderWidget }) => {
  if (widgetAction === "WIDGET_CLICK" && clickAction === "COMPLETE_TASK") {
    const taskId = clickActionData?.taskId as number | undefined;
    if (typeof taskId === "number") {
      await offlineTaskOps.tryComplete(taskId, todayString(), true, 1);
    }
  }
  renderWidget(await render());
};

export function initWidget(): void {
  registerWidgetTaskHandler(widgetTaskHandler);
  taskCache.subscribeDateChanges((date) => {
    if (date !== todayString()) return;
    requestWidgetUpdate({ widgetName: WIDGET_NAME, renderWidget: render });
  });
}
