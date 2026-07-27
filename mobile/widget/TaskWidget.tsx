import React from "react";
import { FlexWidget, HexColor, ListWidget, TextWidget } from "react-native-android-widget";
import { Task } from "../src/api/types";
import { Theme } from "../src/theme";

type Props = {
  theme: Theme;
  tasks: Task[];
};

/** Theme colors are typed as plain `string`; the widget library wants the `#`-prefixed HexColor literal type. */
function hex(color: string): HexColor {
  return color as HexColor;
}

export function TaskWidget({ theme, tasks }: Props) {
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
      <TextWidget
        text="GRIND CONSOLE"
        style={{ color: hex(theme.subtext), fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 8 }}
      />

      {tasks.length === 0 ? (
        <TextWidget text="Nothing due today" style={{ color: hex(theme.subtext), fontSize: 13 }} />
      ) : (
        <ListWidget style={{ width: "match_parent", height: "match_parent" }}>
          {tasks.map((task) => (
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
          ))}
        </ListWidget>
      )}
    </FlexWidget>
  );
}
