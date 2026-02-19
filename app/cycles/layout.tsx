import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Goal Cycles",
  description: "Plan and execute goal cycles of any duration",
};

export default function TwelveWeekYearLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
