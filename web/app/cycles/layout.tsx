import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Goal Cycles",
  description: "Plan and execute goal cycles of any duration",
};

export default function CyclesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
