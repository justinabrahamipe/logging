export type Theme = {
  dark: boolean;
  bg: string;
  card: string;
  border: string;
  text: string;
  subtext: string;
  accent: string;
  success: string;
  danger: string;
  warning: string;
};

// "Daylight Panel" — brushed aluminum chassis under daylight.
// accent is steel blue (matches the chrome lion mark); warning stays amber for flame/heat readouts only.
export const lightTheme: Theme = {
  dark: false,
  bg: "#EDEAE3",
  card: "#F8F6F1",
  border: "#D8D3C7",
  text: "#201D17",
  subtext: "#6E6759",
  accent: "#2C6E9E",
  success: "#2F8F4E",
  danger: "#C23B2E",
  warning: "#D99A2B",
};

// "Night Flight" — cockpit-at-night instrument glow, not an inverted daylight panel.
export const darkTheme: Theme = {
  dark: true,
  bg: "#131110",
  card: "#1E1B17",
  border: "#332C22",
  text: "#F1EADC",
  subtext: "#948A78",
  accent: "#4FA8E8",
  success: "#4ADE80",
  danger: "#FF6B5A",
  warning: "#FBBF24",
};
