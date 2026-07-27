import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Task } from "../api/types";
import { Theme } from "../theme";

const FREQUENCY_LABELS: Record<string, string> = {
  adhoc: "Does not repeat",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  interval: "Every few days",
  custom: "Custom",
};

function frequencyLabel(frequency: string): string {
  return FREQUENCY_LABELS[frequency] ?? frequency;
}

function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function Chip({ theme, icon, label }: { theme: Theme; icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: theme.bg, borderColor: theme.border }]}>
      <Ionicons name={icon} size={12} color={theme.subtext} />
      <Text style={[styles.chipText, { color: theme.subtext }]}>{label}</Text>
    </View>
  );
}

function ActionButton({
  theme,
  icon,
  label,
  onPress,
  color,
}: {
  theme: Theme;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
}) {
  const tint = color ?? theme.accent;
  return (
    <Pressable style={[styles.actionButton, { borderColor: tint }]} onPress={onPress} hitSlop={4}>
      <Ionicons name={icon} size={14} color={tint} />
      <Text style={[styles.actionButtonText, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

type Props = {
  task: Task;
  theme: Theme;
  onCheckboxToggle: (task: Task) => void;
  onCountChange: (task: Task, delta: number) => void;
  onToggleSkip: (task: Task) => void;
  busy: boolean;
  onLongPress?: (task: Task) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onReschedule?: (task: Task, deltaDays: number) => void;
  onScheduleToday?: (task: Task) => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
};

type ActionKind = "increment" | "decrement" | "done" | "undo" | "skip" | "unskip";

const ACTION_ICON: Record<ActionKind, keyof typeof Ionicons.glyphMap> = {
  increment: "add",
  decrement: "remove",
  done: "checkmark",
  undo: "arrow-undo",
  skip: "play-skip-forward",
  unskip: "arrow-undo",
};

export default function TaskRow({
  task, theme, onCheckboxToggle, onCountChange, onToggleSkip, busy, onLongPress, onEdit, onDelete, onReschedule, onScheduleToday,
  expanded: controlledExpanded, onToggleExpand,
}: Props) {
  const swipeableRef = useRef<Swipeable>(null);
  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = onToggleExpand ? !!controlledExpanded : internalExpanded;
  const toggleExpanded = onToggleExpand ?? (() => setInternalExpanded((e) => !e));

  const isCompleted = task.completed;
  const currentValue = task.value;
  const isDiscarded = task.skipped;
  const isLimitTask = task.flexibilityRule === "limit_avoid";
  const limitVal = task.limitValue ?? task.target ?? 0;
  const isFullyDone = !isDiscarded && (
    isLimitTask ? isCompleted : (isCompleted || (task.target != null && task.target > 0 && currentValue >= task.target))
  );
  const isNonCheckbox = task.completionType !== "checkbox";
  const swipeIncrement = isNonCheckbox ? Math.max(1, Math.round((isLimitTask ? limitVal : task.target || 10) * 0.1)) : 0;
  const isAtZero = isNonCheckbox && currentValue <= 0;
  const hasProgress = isNonCheckbox && task.target != null && task.target > 0;

  const handleSwipeRight = () => {
    if (busy) return;
    if (isDiscarded) onToggleSkip(task);
    else if (task.completionType === "checkbox" || isFullyDone) onCheckboxToggle(task);
    else onCountChange(task, swipeIncrement);
  };

  const handleCheckboxTap = () => {
    if (busy) return;
    if (isDiscarded) onToggleSkip(task);
    else onCheckboxToggle(task);
  };

  const handleSwipeLeft = () => {
    if (busy) return;
    if (isDiscarded) onToggleSkip(task);
    else if (task.completionType === "checkbox") {
      if (isFullyDone) onCheckboxToggle(task);
      else onToggleSkip(task);
    } else if (isFullyDone || isAtZero) onToggleSkip(task);
    else onCountChange(task, -swipeIncrement);
  };

  const showIncrement = isNonCheckbox && !isFullyDone && !isDiscarded;

  const rightPaneKind: ActionKind = isDiscarded ? "unskip" : showIncrement ? "increment" : isFullyDone ? "undo" : "done";
  const rightPaneLabel = isDiscarded ? "Unskip" : showIncrement ? `+${swipeIncrement}` : isFullyDone ? "Undo" : "Done";

  const leftPaneKind: ActionKind = isDiscarded
    ? "unskip"
    : showIncrement && !isAtZero
      ? "decrement"
      : isFullyDone
        ? "undo"
        : "skip";
  const leftPaneLabel = isDiscarded ? "Unskip" : (showIncrement && !isAtZero ? `-${swipeIncrement}` : (isFullyDone ? "Undo" : "Skip"));

  const renderAction = (kind: ActionKind, label: string, progress: Animated.AnimatedInterpolation<number>, align: "start" | "end") => {
    const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1], extrapolate: "clamp" });
    const opacity = progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0.7, 1], extrapolate: "clamp" });
    return (
      <Animated.View
        style={[
          styles.actionContent,
          align === "end" && styles.actionContentEnd,
          { opacity, transform: [{ scale }] },
        ]}
      >
        {align === "start" && <Ionicons name={ACTION_ICON[kind]} size={16} color="#fff" style={styles.actionIcon} />}
        <Text style={styles.actionText}>{label}</Text>
        {align === "end" && <Ionicons name={ACTION_ICON[kind]} size={16} color="#fff" style={styles.actionIcon} />}
      </Animated.View>
    );
  };

  return (
    <View style={styles.wrapper}>
      <Swipeable
        ref={swipeableRef}
        leftThreshold={60}
        rightThreshold={60}
        friction={1.5}
        overshootLeft={false}
        overshootRight={false}
        renderLeftActions={(progress) => (
          <View style={[styles.actionPane, { backgroundColor: theme.success }]}>
            {renderAction(rightPaneKind, rightPaneLabel, progress, "start")}
          </View>
        )}
        renderRightActions={(progress) => (
          <View style={[styles.actionPane, styles.actionPaneRight, { backgroundColor: theme.warning }]}>
            {renderAction(leftPaneKind, leftPaneLabel, progress, "end")}
          </View>
        )}
        onSwipeableOpen={(direction) => {
          if (direction === "left") handleSwipeRight();
          else handleSwipeLeft();
          swipeableRef.current?.close();
        }}
      >
        <View
          style={[
            styles.container,
            {
              borderColor: theme.border,
              backgroundColor: expanded ? withAlpha(theme.accent, 0.08) : theme.card,
              opacity: isDiscarded ? 0.6 : busy ? 0.6 : 1,
            },
          ]}
        >
          <Pressable
            style={styles.row}
            onPress={toggleExpanded}
            onLongPress={onLongPress ? () => onLongPress(task) : undefined}
          >
            <View style={styles.info}>
              <Text
                style={[styles.name, { color: theme.text, textDecorationLine: isFullyDone ? "line-through" : "none" }]}
                numberOfLines={2}
              >
                {task.name}
              </Text>
              {hasProgress && (
                <Text style={[styles.progress, { color: theme.subtext }]}>
                  {task.value} / {task.target}
                  {task.unit ? ` ${task.unit}` : ""}
                </Text>
              )}
            </View>
            <Pressable
              style={[
                styles.checkbox,
                { borderColor: isFullyDone ? theme.success : theme.border, backgroundColor: isFullyDone ? theme.success : "transparent" },
              ]}
              onPress={handleCheckboxTap}
              hitSlop={8}
            >
              {isFullyDone && <Text style={styles.check}>✓</Text>}
            </Pressable>
          </Pressable>

          {expanded && (
            <View style={[styles.details, { borderColor: theme.border }]}>
              <View style={styles.chipRow}>
                <Chip theme={theme} icon="star-outline" label={`${task.basePoints} pts`} />
                {!!task.date && <Chip theme={theme} icon="calendar-outline" label={task.date} />}
                <Chip theme={theme} icon="repeat" label={frequencyLabel(task.frequency)} />
                {isLimitTask && task.limitValue != null && (
                  <Chip theme={theme} icon="warning-outline" label={`Limit ${task.limitValue}${task.unit ? ` ${task.unit}` : ""}`} />
                )}
              </View>

              {!!task.description && (
                <Text style={[styles.description, { color: theme.subtext }]}>{task.description}</Text>
              )}

              <View style={styles.actionsRow}>
                {onEdit && (
                  <ActionButton theme={theme} icon="create-outline" label="Edit" onPress={() => onEdit(task)} />
                )}
                {onReschedule && !!task.date && (
                  <>
                    <ActionButton theme={theme} icon="arrow-back-outline" label="Prepone" onPress={() => onReschedule(task, -1)} />
                    <ActionButton theme={theme} icon="arrow-forward-outline" label="Postpone" onPress={() => onReschedule(task, 1)} />
                  </>
                )}
                {onScheduleToday && !task.date && (
                  <ActionButton theme={theme} icon="today-outline" label="Do it today" onPress={() => onScheduleToday(task)} />
                )}
                {onDelete && (
                  <ActionButton theme={theme} icon="trash-outline" label="Delete" color={theme.danger} onPress={() => onDelete(task)} />
                )}
              </View>
            </View>
          )}
        </View>
      </Swipeable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 10,
  },
  container: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: "500" },
  progress: { fontSize: 12, marginTop: 2 },
  details: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 10,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: 11, fontWeight: "600" },
  description: { fontSize: 13, lineHeight: 18 },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionButtonText: { fontSize: 12, fontWeight: "600" },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  check: { color: "#fff", fontSize: 14, fontWeight: "700" },
  actionPane: { flex: 1, justifyContent: "center", paddingLeft: 20 },
  actionPaneRight: { alignItems: "flex-end", paddingRight: 20, paddingLeft: 0 },
  actionContent: { flexDirection: "row", alignItems: "center" },
  actionContentEnd: { flexDirection: "row-reverse" },
  actionIcon: { marginHorizontal: 6 },
  actionText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
