import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, ApiRequestError, isOfflineError } from "../api/client";
import { ScoreHistoryResponse, Task, TodayResponse } from "../api/types";
import { useAppTheme } from "../hooks/useAppTheme";
import { useTaskActions } from "../hooks/useTaskActions";
import * as mutationQueue from "../offline/mutationQueue";
import * as syncEngine from "../offline/syncEngine";
import * as taskCache from "../offline/taskCache";
import TaskRow from "./TaskRow";
import WeekFlames from "./WeekFlames";

type Props = {
  date: string;
  onEditTask?: (task: Task) => void;
};

export default function TaskListView({ date, onEditTask }: Props) {
  const theme = useAppTheme();
  const [data, setData] = useState<TodayResponse | null>(null);
  const [history, setHistory] = useState<ScoreHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const refreshPendingIds = useCallback(async () => {
    setPendingIds(await mutationQueue.getPendingTaskIds());
  }, []);

  useEffect(() => {
    refreshPendingIds();
    return mutationQueue.subscribeChanges(refreshPendingIds);
  }, [refreshPendingIds]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    await syncEngine.drainQueue();

    api.get<ScoreHistoryResponse>("/api/daily-score/history?days=7").then(setHistory).catch(() => {});

    try {
      const res = await api.get<TodayResponse>(`/api/tasks?date=${date}`);
      if (!(await mutationQueue.hasPendingForDate(date))) {
        setData(res);
        await taskCache.setForDate(date, res);
      }
    } catch (err) {
      if (isOfflineError(err)) {
        const cached = await taskCache.getForDate(date);
        if (cached) {
          setData(cached);
        } else {
          setError("No cached tasks for this day yet — connect once to load them.");
        }
      } else {
        setError(err instanceof ApiRequestError ? err.message : "Couldn't load tasks.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [date]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    return syncEngine.onDropped((message) => setError(message));
  }, []);

  const applyLocalUpdate = (taskId: number, patch: Partial<Task>) => {
    setData((prev) => {
      if (!prev) return prev;
      const apply = (t: Task) => (t.id === taskId ? { ...t, ...patch } : t);
      return {
        groups: prev.groups.map((g) => ({ ...g, tasks: g.tasks.map(apply) })),
        noDateTasks: prev.noDateTasks.map(apply),
        overdueTasks: prev.overdueTasks.map(apply),
      };
    });
    taskCache.patchTask(date, taskId, patch).catch(() => {});
  };

  const removeLocalTask = (taskId: number) => {
    setData((prev) => {
      if (!prev) return prev;
      const strip = (arr: Task[]) => arr.filter((t) => t.id !== taskId);
      return {
        groups: prev.groups.map((g) => ({ ...g, tasks: strip(g.tasks) })),
        noDateTasks: strip(prev.noDateTasks),
        overdueTasks: strip(prev.overdueTasks),
      };
    });
    taskCache.removeTask(date, taskId).catch(() => {});
  };

  const {
    busyIds, checkboxToggle, countChange, toggleSkip, reschedule, scheduleToday, duplicate, remove,
    timers, numericSubmit, timerToggle, durationManualSubmit, restoreTimers, formatTime,
  } = useTaskActions(
    applyLocalUpdate,
    setError,
    removeLocalTask,
    () => load(true),
    { date },
  );

  useEffect(() => {
    if (!data) return;
    const allTasks = [...data.groups.flatMap((g) => g.tasks), ...data.noDateTasks, ...data.overdueTasks];
    restoreTimers(allTasks);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const confirmDelete = (task: Task) => {
    Alert.alert("Delete task", `Delete "${task.name}"? This can't be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => remove(task) },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  const todayTasks = data?.groups.flatMap((g) => g.tasks) ?? [];
  const overdueList = data?.overdueTasks ?? [];
  const noDateList = data?.noDateTasks ?? [];

  const todoTasks = todayTasks.filter((t) => !t.completed && !t.skipped);
  const overdueActive = overdueList.filter((t) => !t.completed && !t.skipped);
  const noDateActive = noDateList.filter((t) => !t.completed && !t.skipped);

  const doneTasks = [
    ...todayTasks.filter((t) => t.completed && !t.skipped),
    ...overdueList.filter((t) => t.completed && !t.skipped),
    ...noDateList.filter((t) => t.completed && !t.skipped),
  ];

  const skippedTasks = [
    ...todayTasks.filter((t) => t.skipped),
    ...overdueList.filter((t) => t.skipped),
    ...noDateList.filter((t) => t.skipped),
  ];

  const sections = [
    ...(overdueActive.length ? [{ key: "overdue", title: "Overdue", tasks: overdueActive }] : []),
    ...(todoTasks.length ? [{ key: "todo", title: "To do", tasks: todoTasks }] : []),
    ...(doneTasks.length ? [{ key: "done", title: "Done", tasks: doneTasks }] : []),
    ...(skippedTasks.length ? [{ key: "skipped", title: "Skipped", tasks: skippedTasks }] : []),
    ...(noDateActive.length ? [{ key: "nodate", title: "No date", tasks: noDateActive }] : []),
  ];

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.accent} />}
    >
      {history && <WeekFlames theme={theme} entries={history.scores} />}

      {error && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}

      {sections.length === 0 && (
        <Text style={[styles.empty, { color: theme.subtext }]}>Nothing scheduled for this day.</Text>
      )}

      {sections.map((section) => {
        const isCollapsed = collapsedSections.has(section.key);
        return (
          <View key={section.key} style={styles.section}>
            <Pressable style={styles.sectionHeader} onPress={() => toggleSection(section.key)}>
              <Ionicons name={isCollapsed ? "chevron-down" : "chevron-up"} size={14} color={theme.subtext} />
              <Text style={[styles.sectionTitle, { color: theme.subtext }]}>
                {section.title} ({section.tasks.length})
              </Text>
              <View style={[styles.sectionRule, { backgroundColor: theme.border }]} />
            </Pressable>
            {!isCollapsed && section.tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                theme={theme}
                onCheckboxToggle={checkboxToggle}
                onCountChange={countChange}
                onToggleSkip={toggleSkip}
                onNumericSubmit={numericSubmit}
                onTimerToggle={timerToggle}
                onDurationManualSubmit={durationManualSubmit}
                timer={timers[task.id]}
                formatTime={formatTime}
                busy={busyIds.has(task.id)}
                pendingSync={pendingIds.has(task.id)}
                onLongPress={onEditTask}
                onEdit={onEditTask}
                onDelete={confirmDelete}
                onDuplicate={duplicate}
                onReschedule={reschedule}
                onScheduleToday={scheduleToday}
                expanded={expandedTaskId === task.id}
                onToggleExpand={() => setExpandedTaskId((id) => (id === task.id ? null : task.id))}
              />
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { padding: 16, paddingBottom: 100 },
  section: { marginBottom: 16 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, marginBottom: 8 },
  sectionTitle: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  sectionRule: { flex: 1, height: StyleSheet.hairlineWidth, marginLeft: 4 },
  error: { marginBottom: 12, fontSize: 13 },
  empty: { textAlign: "center", marginTop: 40, fontSize: 14 },
});
