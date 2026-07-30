import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, ApiRequestError } from "../../api/client";
import { Goal, GoalTask, Task } from "../../api/types";
import TaskRow from "../../components/TaskRow";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useTaskActions } from "../../hooks/useTaskActions";
import { GoalsStackParamList } from "../../navigation/types";
import { todayString } from "../../utils/date";

type Props = NativeStackScreenProps<GoalsStackParamList, "GoalDetail">;

function goalTaskToTask(gt: GoalTask): Task {
  return {
    id: gt.id, userId: "", pillarId: null, goalId: gt.goalId, scheduleId: null,
    name: gt.name, completionType: gt.completionType, target: gt.target, unit: gt.unit,
    basePoints: gt.basePoints, flexibilityRule: "must_today", limitValue: null,
    date: gt.date, completed: gt.completed, value: gt.value, pointsEarned: 0,
    isHighlighted: false, skipped: false, timerStartedAt: null, dismissed: false,
    frequency: "adhoc", completion: null,
  };
}

export default function GoalDetailScreen({ route, navigation }: Props) {
  const theme = useAppTheme();
  const { goalId } = route.params;
  const [goal, setGoal] = useState<Goal | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logValue, setLogValue] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [goals, goalTasks] = await Promise.all([
        api.get<Goal[]>("/api/goals"),
        api.get<GoalTask[]>("/api/goals/tasks"),
      ]);
      const found = goals.find((g) => g.id === goalId) ?? null;
      setGoal(found);
      setTasks(goalTasks.filter((t) => t.goalId === goalId).map(goalTaskToTask));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't load goal.");
    } finally {
      setLoading(false);
    }
  }, [goalId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const applyPatch = (taskId: number, patch: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
  };
  const { busyIds, checkboxToggle, countChange, toggleSkip, numericSubmit, timerToggle, durationManualSubmit, timers, restoreTimers, formatTime } = useTaskActions(applyPatch, setError);

  useEffect(() => {
    restoreTimers(tasks);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  const changeStatus = async (status: Goal["status"]) => {
    if (!goal) return;
    setSaving(true);
    try {
      const updated = await api.put<Goal>(`/api/goals/${goal.id}`, { status });
      setGoal(updated);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't update goal.");
    } finally {
      setSaving(false);
    }
  };

  const confirmStatus = (status: Goal["status"], title: string, message: string) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: title, style: status === "abandoned" ? "destructive" : "default", onPress: () => changeStatus(status) },
    ]);
  };

  const handleDelete = () => {
    if (!goal) return;
    Alert.alert("Delete goal", "This also deletes its linked tasks. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            await api.delete(`/api/goals/${goal.id}`);
            navigation.goBack();
          } catch (err) {
            setError(err instanceof ApiRequestError ? err.message : "Couldn't delete goal.");
          }
        },
      },
    ]);
  };

  const submitLog = async () => {
    if (!goal || !logValue.trim()) return;
    setSaving(true);
    try {
      await api.post(`/api/goals/${goal.id}/log`, { value: Number(logValue), loggedAt: todayString() });
      setLogModalOpen(false);
      setLogValue("");
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't log progress.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !goal) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.bg }]} edges={["top"]}>
        <ActivityIndicator color={theme.accent} />
      </SafeAreaView>
    );
  }

  const todoTasks = tasks.filter((t) => !t.completed && !t.skipped);
  const doneTasks = tasks.filter((t) => t.completed && !t.skipped);
  const skippedTasks = tasks.filter((t) => t.skipped);

  const progressText = goal.goalType === "project"
    ? `${goal.currentValue} of ${goal.targetValue} steps`
    : goal.completionType === "checkbox"
      ? undefined
      : `${goal.currentValue}${goal.targetValue ? ` / ${goal.targetValue}` : ""}${goal.unit ? ` ${goal.unit}` : ""}`;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.bg }]} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.name, { color: theme.text }]}>{goal.name}</Text>
        <Text style={[styles.meta, { color: theme.subtext }]}>
          {goal.pillarEmoji ? `${goal.pillarEmoji} ` : ""}{goal.pillarName ?? "No pillar"} · {goal.goalType} · {goal.status}
        </Text>
        {progressText && <Text style={[styles.progress, { color: theme.accent }]}>{progressText}</Text>}
        {error && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}

        <View style={styles.actions}>
          {goal.status === "active" ? (
            <>
              {goal.goalType !== "project" && (
                <Pressable style={[styles.actionBtn, { borderColor: theme.accent }]} onPress={() => setLogModalOpen(true)}>
                  <Text style={[styles.actionText, { color: theme.accent }]}>Log Progress</Text>
                </Pressable>
              )}
              <Pressable style={[styles.actionBtn, { borderColor: theme.border }]} onPress={() => navigation.navigate("GoalForm", { goalId: goal.id })}>
                <Text style={[styles.actionText, { color: theme.text }]}>Edit</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, { borderColor: theme.success }]}
                onPress={() => confirmStatus("completed", "Complete", "Mark this goal as completed?")}
              >
                <Text style={[styles.actionText, { color: theme.success }]}>Complete</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, { borderColor: theme.danger }]}
                onPress={() => confirmStatus("abandoned", "Abandon", "Abandon this goal? Future tasks will be removed.")}
              >
                <Text style={[styles.actionText, { color: theme.danger }]}>Abandon</Text>
              </Pressable>
            </>
          ) : (
            <Pressable style={[styles.actionBtn, { borderColor: theme.accent }]} onPress={() => changeStatus("active")}>
              <Text style={[styles.actionText, { color: theme.accent }]}>Reactivate</Text>
            </Pressable>
          )}
          <Pressable style={[styles.actionBtn, { borderColor: theme.danger }]} onPress={handleDelete}>
            <Text style={[styles.actionText, { color: theme.danger }]}>Delete</Text>
          </Pressable>
        </View>

        {tasks.length > 0 && [
          { key: "todo", title: "To do", list: todoTasks },
          { key: "done", title: "Done", list: doneTasks },
          { key: "skipped", title: "Skipped", list: skippedTasks },
        ].map(({ key, title, list }) => list.length > 0 && (
          <View key={key} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.subtext }]}>{title} ({list.length})</Text>
              <View style={[styles.sectionRule, { backgroundColor: theme.border }]} />
            </View>
            {list.map((task) => (
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
              />
            ))}
          </View>
        ))}
      </ScrollView>

      <Modal visible={logModalOpen} transparent animationType="slide" onRequestClose={() => setLogModalOpen(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setLogModalOpen(false)} />
          <SafeAreaView edges={["bottom"]} style={[styles.modalCard, { backgroundColor: theme.card }]}>
            <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>Log progress</Text>
            <TextInput
              style={[styles.modalInput, { color: theme.text, borderColor: theme.border }]}
              value={logValue}
              onChangeText={setLogValue}
              placeholder={`Value${goal.unit ? ` (${goal.unit})` : ""}`}
              placeholderTextColor={theme.subtext}
              keyboardType="numeric"
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setLogModalOpen(false)}>
                <Text style={{ color: theme.subtext }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={submitLog} disabled={saving}>
                {saving ? <ActivityIndicator color={theme.accent} /> : <Text style={{ color: theme.accent, fontWeight: "700" }}>Save</Text>}
              </Pressable>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { padding: 16, paddingBottom: 40 },
  name: { fontSize: 24, fontWeight: "700" },
  meta: { fontSize: 13, marginTop: 4, textTransform: "capitalize" },
  progress: { fontSize: 16, fontWeight: "600", marginTop: 8 },
  error: { marginTop: 12, fontSize: 13 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  actionBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  actionText: { fontSize: 13, fontWeight: "600" },
  section: { marginTop: 20 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, marginBottom: 8 },
  sectionTitle: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  sectionRule: { flex: 1, height: StyleSheet.hairlineWidth, marginLeft: 4 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: { width: "100%", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  modalInput: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 20, marginTop: 16 },
});
