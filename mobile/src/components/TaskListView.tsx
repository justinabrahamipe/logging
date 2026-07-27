import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, ApiRequestError } from "../api/client";
import { ScoreHistoryResponse, Task, TodayResponse } from "../api/types";
import { useAppTheme } from "../hooks/useAppTheme";
import { useTaskActions } from "../hooks/useTaskActions";
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

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [res, historyRes] = await Promise.all([
        api.get<TodayResponse>(`/api/tasks?date=${date}`),
        api.get<ScoreHistoryResponse>("/api/daily-score/history?days=7"),
      ]);
      setData(res);
      setHistory(historyRes);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't load tasks.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

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
  };

  const { busyIds, checkboxToggle, countChange, toggleSkip, reschedule, scheduleToday, remove } = useTaskActions(applyLocalUpdate, setError, removeLocalTask);

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
  const todoTasks = todayTasks.filter((t) => !t.completed);
  const doneTasks = todayTasks.filter((t) => t.completed);

  const sections = [
    ...(data?.overdueTasks.length ? [{ key: "overdue", title: "Overdue", tasks: data.overdueTasks }] : []),
    ...(todoTasks.length ? [{ key: "todo", title: "To do", tasks: todoTasks }] : []),
    ...(doneTasks.length ? [{ key: "done", title: "Done", tasks: doneTasks }] : []),
    ...(data?.noDateTasks.length ? [{ key: "nodate", title: "No date", tasks: data.noDateTasks }] : []),
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
                busy={busyIds.has(task.id)}
                onLongPress={onEditTask}
                onEdit={onEditTask}
                onDelete={confirmDelete}
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
