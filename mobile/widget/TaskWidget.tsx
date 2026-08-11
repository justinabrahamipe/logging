import React from "react";
import { FlexWidget, HexColor, ListWidget, TextWidget } from "react-native-android-widget";
import { Task } from "../src/api/types";
import { Theme } from "../src/theme";
import { todayString } from "../src/utils/date";

type Props = {
  theme: Theme;
  overdue: Task[];
  today: Task[];
  todayPct: number;
};

/** Theme colors are typed as plain `string`; the widget library wants the `#`-prefixed HexColor literal type. */
function hex(color: string): HexColor {
  return color as HexColor;
}

// A "liquid fill" circle: bottom-up fill clipped to a round mask. This widget renderer
// has no SVG/arc support and no absolute positioning (no way to overlay a stroke-arc
// ring or center text on top of a shape — see mobile/src/components/WeekRings.tsx for
// the real ring used in-app), so the circle fills like a gauge instead of sweeping like
// a progress ring. The percentage sits next to it since it can't sit inside it.
function FillCircle({ pct, theme, size = 20 }: { pct: number; theme: Theme; size?: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const fillHeight = Math.round((clamped / 100) * size);
  return (
    <FlexWidget
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: hex(theme.border),
        overflow: "hidden",
        justifyContent: "flex-end",
      }}
    >
      {fillHeight > 0 && (
        <FlexWidget style={{ width: "match_parent", height: fillHeight, backgroundColor: hex(theme.warning) }} />
      )}
    </FlexWidget>
  );
}

function CheckCircle({ task, theme }: { task: Task; theme: Theme }) {
  return (
    <FlexWidget
      clickAction="COMPLETE_TASK"
      clickActionData={{ taskId: task.id }}
      style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: hex(theme.border),
        backgroundColor: hex(theme.bg),
        marginRight: 12,
      }}
    />
  );
}

function CountPill({ task, theme }: { task: Task; theme: Theme }) {
  const target = task.flexibilityRule === "limit_avoid" ? task.limitValue ?? task.target ?? 0 : task.target ?? 0;
  return (
    <FlexWidget
      clickAction="INCREMENT_TASK"
      clickActionData={{ taskId: task.id }}
      style={{
        height: 24,
        borderRadius: 12,
        paddingHorizontal: 8,
        backgroundColor: hex(theme.accent),
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
      }}
    >
      <TextWidget
        text={`${task.value}${target ? `/${target}` : ""}`}
        style={{ color: "#ffffff" as HexColor, fontSize: 11, fontWeight: "700" }}
      />
    </FlexWidget>
  );
}

function TaskRow({ task, theme }: { task: Task; theme: Theme }) {
  return (
    <FlexWidget
      key={task.id}
      style={{
        flexDirection: "row",
        alignItems: "center",
        width: "match_parent",
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: hex(theme.border),
      }}
    >
      {task.completionType === "count" ? (
        <CountPill task={task} theme={theme} />
      ) : (
        <CheckCircle task={task} theme={theme} />
      )}
      <FlexWidget style={{ flex: 1 }}>
        <TextWidget
          text={task.name}
          style={{ color: hex(theme.text), fontSize: 14, width: "match_parent" }}
          maxLines={2}
          truncate="END"
        />
      </FlexWidget>
    </FlexWidget>
  );
}

function SectionHeader({ text, color }: { text: string; color: string }) {
  return (
    <TextWidget
      text={text}
      style={{ color: hex(color), fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginTop: 10, marginBottom: 4 }}
    />
  );
}

export function TaskWidget({ theme, overdue, today, todayPct }: Props) {
  const hasTasks = overdue.length > 0 || today.length > 0;
  const addTaskUri = `grindconsole://tasks/new?date=${todayString()}`;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: hex(theme.card),
        borderRadius: 20,
        borderWidth: 1,
        borderColor: hex(theme.border),
        padding: 14,
        flexDirection: "column",
      }}
    >
      <FlexWidget
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent" }}
      >
        <TextWidget
          text="GRIND CONSOLE"
          style={{ color: hex(theme.subtext), fontSize: 11, fontWeight: "700", letterSpacing: 1.5 }}
        />
        <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
          <FlexWidget style={{ flexDirection: "row", alignItems: "center", marginRight: 10 }}>
            <FillCircle pct={todayPct} theme={theme} />
            <TextWidget
              text={`${Math.round(todayPct)}%`}
              style={{ color: hex(theme.subtext), fontSize: 11, fontWeight: "700", marginLeft: 5 }}
            />
          </FlexWidget>
          <FlexWidget
            clickAction="OPEN_URI"
            clickActionData={{ uri: addTaskUri }}
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: hex(theme.accent),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TextWidget text="+" style={{ color: "#ffffff" as HexColor, fontSize: 16, fontWeight: "700" }} />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>

      {!hasTasks ? (
        <FlexWidget style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <TextWidget text="All clear ✓" style={{ color: hex(theme.subtext), fontSize: 13 }} />
        </FlexWidget>
      ) : (
        <ListWidget style={{ width: "match_parent", height: "match_parent" }}>
          {overdue.length > 0 && <SectionHeader key="overdue-header" text="OVERDUE" color={theme.danger} />}
          {overdue.map((task) => <TaskRow key={task.id} task={task} theme={theme} />)}
          {today.length > 0 && <SectionHeader key="today-header" text="TODAY" color={theme.subtext} />}
          {today.map((task) => <TaskRow key={task.id} task={task} theme={theme} />)}
        </ListWidget>
      )}
    </FlexWidget>
  );
}
