import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useLayoutEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, ApiRequestError, isOfflineError } from "../api/client";
import { CompletionType, FlexibilityRule, Pillar, Task } from "../api/types";
import DateField from "../components/DateField";
import DayOfWeekPicker from "../components/DayOfWeekPicker";
import { FormInput } from "../components/FormField";
import FormSection from "../components/FormSection";
import SegmentedControl from "../components/SegmentedControl";
import SelectField from "../components/SelectField";
import { useAppTheme } from "../hooks/useAppTheme";
import { TasksStackParamList } from "../navigation/types";
import * as offlineTaskOps from "../offline/offlineTaskOps";

type Props = NativeStackScreenProps<TasksStackParamList, "TaskForm">;

type FrequencyPreset = "adhoc" | "daily" | "weekdays" | "custom";
type RepeatUnit = "days" | "weeks" | "months";

type TaskApiRecord = Task & {
  customDays?: string | null;
  repeatInterval?: number | null;
  endDate?: string | null;
};

const COMPLETION_TYPE_OPTIONS: { value: CompletionType; label: string }[] = [
  { value: "checkbox", label: "Checkbox" },
  { value: "count", label: "Count" },
  { value: "numeric", label: "Numeric" },
  { value: "duration", label: "Duration" },
];

const FREQUENCY_OPTIONS: { value: FrequencyPreset; label: string }[] = [
  { value: "adhoc", label: "None" },
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "custom", label: "Custom" },
];

const REPEAT_UNIT_OPTIONS: { value: RepeatUnit; label: string }[] = [
  { value: "days", label: "Days" },
  { value: "weeks", label: "Weeks" },
  { value: "months", label: "Months" },
];

const MODE_OPTIONS: { value: FlexibilityRule; label: string }[] = [
  { value: "must_today", label: "Target" },
  { value: "limit_avoid", label: "Limit" },
];

function parseCustomDays(customDays: string | null | undefined): number[] {
  if (!customDays) return [];
  try {
    const parsed = JSON.parse(customDays);
    if (Array.isArray(parsed)) return parsed.map(Number);
  } catch {
    // fall through to comma-separated parsing
  }
  return customDays.split(",").map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n));
}

function taskToPreset(raw: TaskApiRecord): {
  preset: FrequencyPreset;
  repeatInterval: string;
  repeatUnit: RepeatUnit;
  customDays: number[];
  monthDay: number;
} {
  const customDays = parseCustomDays(raw.customDays);
  const repeatInterval = raw.repeatInterval ?? null;

  if (raw.frequency === "adhoc") return { preset: "adhoc", repeatInterval: "1", repeatUnit: "days", customDays: [], monthDay: 1 };
  if (raw.frequency === "daily") return { preset: "daily", repeatInterval: "1", repeatUnit: "days", customDays: [], monthDay: 1 };

  if (raw.frequency === "custom" && !repeatInterval) {
    const sorted = [...customDays].sort().join(",");
    if (sorted === "1,2,3,4,5") return { preset: "weekdays", repeatInterval: "1", repeatUnit: "weeks", customDays, monthDay: 1 };
  }

  if (raw.frequency === "weekly") return { preset: "custom", repeatInterval: "1", repeatUnit: "weeks", customDays: [1], monthDay: 1 };

  if (raw.frequency === "custom") {
    const weekInterval = repeatInterval ? Math.round(repeatInterval / 7) : 1;
    return { preset: "custom", repeatInterval: String(weekInterval), repeatUnit: "weeks", customDays, monthDay: 1 };
  }

  if (raw.frequency === "monthly") {
    return { preset: "custom", repeatInterval: String(repeatInterval || 1), repeatUnit: "months", customDays: [], monthDay: customDays[0] || 1 };
  }

  if (raw.frequency === "interval") {
    return { preset: "custom", repeatInterval: String(repeatInterval || 1), repeatUnit: "days", customDays: [], monthDay: 1 };
  }

  return { preset: "daily", repeatInterval: "1", repeatUnit: "days", customDays: [], monthDay: 1 };
}

export default function TaskFormScreen({ route, navigation }: Props) {
  const theme = useAppTheme();
  const editingId = route.params.taskId;
  const isEditing = editingId != null;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pillars, setPillars] = useState<Pillar[]>([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [completionType, setCompletionType] = useState<CompletionType>("checkbox");
  const [flexibilityRule, setFlexibilityRule] = useState<FlexibilityRule>("must_today");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [pillarId, setPillarId] = useState<number | null>(null);
  const [basePoints, setBasePoints] = useState("10");
  const [startDate, setStartDate] = useState<string | null>(route.params.date);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [frequencyPreset, setFrequencyPreset] = useState<FrequencyPreset>("adhoc");
  const [repeatUnit, setRepeatUnit] = useState<RepeatUnit>("days");
  const [repeatInterval, setRepeatInterval] = useState("1");
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [monthDay, setMonthDay] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        const pillarList = await api.get<Pillar[]>("/api/pillars");
        setPillars(pillarList);

        if (isEditing) {
          const raw = await api.get<TaskApiRecord>(`/api/tasks/${editingId}`);
          const freq = taskToPreset(raw);
          setName(raw.name);
          setDescription(raw.description ?? "");
          setCompletionType(raw.completionType);
          setFlexibilityRule(raw.flexibilityRule === "limit_avoid" ? "limit_avoid" : "must_today");
          setTarget(raw.target != null ? String(raw.target) : "");
          setUnit(raw.unit ?? "");
          setPillarId(raw.pillarId);
          setBasePoints(String(raw.basePoints));
          setStartDate(raw.date);
          setEndDate(raw.endDate ?? null);
          setFrequencyPreset(freq.preset);
          setRepeatUnit(freq.repeatUnit);
          setRepeatInterval(freq.repeatInterval);
          setCustomDays(freq.customDays);
          setMonthDay(freq.monthDay);
        }
      } catch (err) {
        setError(err instanceof ApiRequestError ? err.message : "Couldn't load form data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [isEditing, editingId]);

  const toggleCustomDay = (day: number) => {
    setCustomDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  };

  const buildBody = (): Record<string, unknown> => {
    let dbFrequency: string = frequencyPreset;
    let dbCustomDays: string | null = null;
    let dbRepeatInterval: number | null = null;

    if (frequencyPreset === "weekdays") {
      dbFrequency = "custom";
      dbCustomDays = JSON.stringify([1, 2, 3, 4, 5]);
    } else if (frequencyPreset === "custom") {
      if (repeatUnit === "weeks") {
        dbFrequency = "custom";
        dbCustomDays = JSON.stringify(customDays);
        const interval = parseInt(repeatInterval, 10) || 1;
        if (interval > 1) dbRepeatInterval = interval * 7;
      } else if (repeatUnit === "months") {
        dbFrequency = "monthly";
        dbCustomDays = JSON.stringify([monthDay]);
        const interval = parseInt(repeatInterval, 10) || 1;
        if (interval > 1) dbRepeatInterval = interval;
      } else {
        dbFrequency = "interval";
        dbRepeatInterval = parseInt(repeatInterval, 10) || 1;
      }
    }

    const body: Record<string, unknown> = {
      name: name.trim(),
      pillarId,
      completionType,
      flexibilityRule,
      frequency: dbFrequency,
      customDays: dbCustomDays,
      repeatInterval: dbRepeatInterval,
      basePoints: Number(basePoints) || 10,
      description: description.trim() || null,
    };
    body.startDate = startDate;
    if (frequencyPreset !== "adhoc") body.endDate = endDate || null;
    if (target.trim()) body.target = Number(target);
    if (unit.trim()) body.unit = unit.trim();
    if (flexibilityRule === "limit_avoid" && target.trim()) body.limitValue = Number(target);
    return body;
  };

  const patchFromBody = (body: Record<string, unknown>): Partial<Task> => ({
    name: body.name as string,
    pillarId: body.pillarId as number | null,
    completionType: body.completionType as CompletionType,
    flexibilityRule: body.flexibilityRule as FlexibilityRule,
    target: (body.target as number | undefined) ?? null,
    unit: (body.unit as string | undefined) ?? null,
    basePoints: body.basePoints as number,
    date: body.startDate as string,
    frequency: body.frequency as string,
    description: (body.description as string | null | undefined) ?? null,
    limitValue: (body.limitValue as number | undefined) ?? null,
  });

  const createRecurring = async (body: Record<string, unknown>): Promise<{ ok: true } | { ok: false; message: string }> => {
    try {
      await api.post("/api/tasks", body);
      return { ok: true };
    } catch (err) {
      if (isOfflineError(err)) return { ok: false, message: "Recurring tasks need a connection to create." };
      return { ok: false, message: err instanceof ApiRequestError ? err.message : "Couldn't save task." };
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const body = buildBody();

    if (isEditing) {
      const result = await offlineTaskOps.tryEdit(editingId as number, startDate || "", patchFromBody(body), body);
      if (!result.ok && !result.queued) setError(result.message);
      else navigation.goBack();
    } else if (frequencyPreset !== "adhoc") {
      const result = await createRecurring(body);
      if (result.ok) navigation.goBack();
      else setError(result.message);
    } else {
      const result = await offlineTaskOps.tryCreate(body);
      if (!result.ok && !result.queued) setError(result.message);
      else navigation.goBack();
    }
    setSaving(false);
  };

  const handleSaveAndAddAnother = async () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const body = buildBody();

    if (frequencyPreset !== "adhoc") {
      const result = await createRecurring(body);
      if (result.ok) {
        setName("");
        setDescription("");
      } else {
        setError(result.message);
      }
    } else {
      const result = await offlineTaskOps.tryCreate(body);
      if (!result.ok && !result.queued) {
        setError(result.message);
      } else {
        setName("");
        setDescription("");
      }
    }
    setSaving(false);
  };

  const handleDelete = () => {
    if (!isEditing) return;
    Alert.alert("Delete task", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          const result = await offlineTaskOps.tryRemove(editingId as number, startDate || "");
          if (!result.ok && !result.queued) setError(result.message);
          else navigation.goBack();
        },
      },
    ]);
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={handleSubmit} disabled={saving || loading} hitSlop={8} style={styles.headerSaveButton}>
          {saving ? (
            <ActivityIndicator color={theme.accent} size="small" />
          ) : (
            <Text style={[styles.headerSaveText, { color: theme.accent }]}>{isEditing ? "Save" : "Create"}</Text>
          )}
        </Pressable>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, handleSubmit, saving, loading, theme, isEditing]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.bg }]} edges={["top"]}>
        <ActivityIndicator color={theme.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.bg }]} edges={["top"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.title, { color: theme.text }]}>{isEditing ? "Edit Task" : "New Task"}</Text>

          <FormSection theme={theme} title="Details">
            <FormInput theme={theme} label="Name" value={name} onChangeText={setName} placeholder="Task name" />
            <FormInput
              theme={theme}
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Optional details"
              multiline
              numberOfLines={3}
              style={styles.descriptionInput}
            />
            <SegmentedControl theme={theme} options={COMPLETION_TYPE_OPTIONS} value={completionType} onChange={setCompletionType} />
            {completionType !== "checkbox" && (
              <SegmentedControl theme={theme} options={MODE_OPTIONS} value={flexibilityRule} onChange={setFlexibilityRule} />
            )}
          </FormSection>

          {completionType !== "checkbox" && (
            <FormSection theme={theme} title={flexibilityRule === "limit_avoid" ? "Limit" : "Target"}>
              <FormInput theme={theme} label="Value" value={target} onChangeText={setTarget} keyboardType="numeric" />
              <FormInput theme={theme} label="Unit" value={unit} onChangeText={setUnit} placeholder="e.g. pages, minutes" />
            </FormSection>
          )}

          <FormSection theme={theme} title="Organize">
            <SelectField
              theme={theme}
              label="Pillar"
              value={pillarId}
              options={pillars.map((p) => ({ value: p.id, label: `${p.emoji ?? ""} ${p.name}`.trim() }))}
              onChange={setPillarId}
            />
            <FormInput theme={theme} label="Points" value={basePoints} onChangeText={setBasePoints} keyboardType="numeric" />
          </FormSection>

          <FormSection theme={theme} title="Repeat">
            <SegmentedControl theme={theme} options={FREQUENCY_OPTIONS} value={frequencyPreset} onChange={setFrequencyPreset} />

            <DateField theme={theme} label={frequencyPreset === "adhoc" ? "Date" : "Start date"} value={startDate} onChange={setStartDate} />
            {frequencyPreset !== "adhoc" && (
              <DateField theme={theme} label="End date" value={endDate} onChange={setEndDate} />
            )}

            {frequencyPreset === "custom" && (
              <>
                <SegmentedControl theme={theme} options={REPEAT_UNIT_OPTIONS} value={repeatUnit} onChange={setRepeatUnit} />
                <FormInput theme={theme} label={`Every N ${repeatUnit}`} value={repeatInterval} onChangeText={setRepeatInterval} keyboardType="numeric" />

                {repeatUnit === "weeks" && <DayOfWeekPicker theme={theme} value={customDays} onChange={setCustomDays} />}

                {repeatUnit === "months" && (
                  <SelectField
                    theme={theme}
                    label="On day"
                    value={monthDay}
                    options={Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: String(i + 1) }))}
                    onChange={(v) => setMonthDay(v ?? 1)}
                  />
                )}
              </>
            )}
          </FormSection>

          {error && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}

          <Pressable style={[styles.saveButton, { backgroundColor: theme.accent, opacity: saving ? 0.6 : 1 }]} onPress={handleSubmit} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>{isEditing ? "Save changes" : "Create task"}</Text>}
          </Pressable>

          {!isEditing && (
            <Pressable
              style={[styles.saveAnotherButton, { borderColor: theme.accent, opacity: saving ? 0.6 : 1 }]}
              onPress={handleSaveAndAddAnother}
              disabled={saving}
            >
              <Text style={[styles.saveAnotherText, { color: theme.accent }]}>Save &amp; add another</Text>
            </Pressable>
          )}

          {isEditing && (
            <Pressable style={styles.deleteButton} onPress={handleDelete}>
              <Text style={[styles.deleteButtonText, { color: theme.danger }]}>Delete task</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 60 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 16 },
  error: { marginTop: 16, fontSize: 13 },
  descriptionInput: { minHeight: 72, textAlignVertical: "top" },
  saveButton: { marginTop: 8, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  saveAnotherButton: { marginTop: 10, borderRadius: 10, borderWidth: 1, paddingVertical: 12, alignItems: "center" },
  saveAnotherText: { fontSize: 14, fontWeight: "600" },
  deleteButton: { marginTop: 16, alignItems: "center", paddingVertical: 8 },
  deleteButtonText: { fontSize: 14, fontWeight: "600" },
  headerSaveButton: { paddingHorizontal: 4, paddingVertical: 4, minWidth: 44, alignItems: "flex-end" },
  headerSaveText: { fontSize: 16, fontWeight: "700" },
});
