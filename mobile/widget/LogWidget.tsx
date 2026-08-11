import React from "react";
import { FlexWidget, HexColor, TextWidget } from "react-native-android-widget";
import { Theme } from "../src/theme";

type Props = {
  theme: Theme;
};

/** Theme colors are typed as plain `string`; the widget library wants the `#`-prefixed HexColor literal type. */
function hex(color: string): HexColor {
  return color as HexColor;
}

// The whole card deep-links into the Log screen via OPEN_URI, handled natively by the
// widget provider — no JS task handler needed for the tap itself.
export function LogWidget({ theme }: Props) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: "grindconsole://log" }}
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: hex(theme.card),
        borderRadius: 20,
        borderWidth: 1,
        borderColor: hex(theme.border),
        padding: 12,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <FlexWidget
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: hex(theme.accent),
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 6,
        }}
      >
        <TextWidget text="+" style={{ color: "#ffffff" as HexColor, fontSize: 18, fontWeight: "700" }} />
      </FlexWidget>
      <TextWidget
        text="NEW LOG"
        style={{ color: hex(theme.subtext), fontSize: 11, fontWeight: "700", letterSpacing: 1.5 }}
      />
    </FlexWidget>
  );
}
