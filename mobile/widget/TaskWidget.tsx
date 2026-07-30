import React from "react";
import { FlexWidget, HexColor, ListWidget, TextWidget } from "react-native-android-widget";
import { Task } from "../src/api/types";
import { Theme } from "../src/theme";
import { todayString } from "../src/utils/date";

type Props = {
  theme: Theme;
  overdue: Task[];
  today: Task[];
};

/** Theme colors are typed as plain `string`; the widget library wants the `#`-prefixed HexColor literal type. */
function hex(color: string): HexColor {
  return color as HexColor;
}

function TaskRow({ task, theme }: { task: Task; theme: Theme }) {
  return (
    <FlexWidget
      key={task.id}
      style={{ flexDirection: "row", alignItems: "center", width: "match_parent", paddingVertical: 6 }}
    >
      <FlexWidget
        clickAction="COMPLETE_TASK"
        clickActionData={{ taskId: task.id }}
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 2,
          borderColor: hex(theme.border),
          backgroundColor: hex(theme.bg),
          marginRight: 10,
        }}
      />
      <TextWidget
        text={task.name}
        style={{ color: hex(theme.text), fontSize: 14 }}
        maxLines={1}
        truncate="END"
      />
    </FlexWidget>
  );
}

function SectionHeader({ text, color }: { text: string; color: string }) {
  return (
    <TextWidget
      text={text}
      style={{ color: hex(color), fontSize: 10, fontWeight: "700", letterSpacing: 1, marginTop: 6, marginBottom: 2 }}
    />
  );
}

export function TaskWidget({ theme, overdue, today }: Props) {
  const hasTasks = overdue.length > 0 || today.length > 0;
  const addTaskUri = `grindconsole://tasks/new?date=${todayString()}`;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: hex(theme.card),
        borderRadius: 16,
        padding: 12,
        flexDirection: "column",
      }}
    >
      <FlexWidget
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "match_parent", marginBottom: 8 }}
      >
        <TextWidget
          text="GRIND CONSOLE"
          style={{ color: hex(theme.subtext), fontSize: 11, fontWeight: "700", letterSpacing: 1 }}
        />
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: addTaskUri }}
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: hex(theme.accent),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <TextWidget text="+" style={{ color: "#ffffff" as HexColor, fontSize: 16, fontWeight: "700" }} />
        </FlexWidget>
      </FlexWidget>

      {!hasTasks ? (
        <TextWidget text="Nothing due today" style={{ color: hex(theme.subtext), fontSize: 13 }} />
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
