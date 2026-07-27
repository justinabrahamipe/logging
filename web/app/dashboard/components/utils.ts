import type { HistoryScore } from "@/lib/types";

export function getTierColor(tier: string): string {
  switch (tier) {
    case "LEGENDARY":
      return "#FFD700";
    case "Excellent":
      return "#22C55E";
    case "Good":
      return "#3B82F6";
    case "Decent":
      return "#F59E0B";
    case "Needs Work":
      return "#F97316";
    case "Poor":
      return "#EF4444";
    default:
      return "#6B7280";
  }
}

export function getHeatmapColor(score: number | null, threshold = 95): string {
  if (score === null) return "bg-zinc-200 dark:bg-zinc-700";
  if (score >= threshold) return "bg-green-500";
  if (score >= 75) return "bg-emerald-400";
  if (score >= 50) return "bg-yellow-500";
  if (score >= 25) return "bg-orange-500";
  return "bg-red-500";
}

export function getHeatmapOpacity(score: number | null, threshold = 95): string {
  if (score === null) return "opacity-40";
  if (score >= threshold) return "opacity-100";
  if (score >= 75) return "opacity-90";
  if (score >= 50) return "opacity-80";
  if (score >= 25) return "opacity-80";
  return "opacity-80";
}

export function getPresetDates(preset: string): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().split("T")[0];
  if (preset === "day") return { start: end, end };
  const s = new Date(now);
  if (preset === "week") s.setDate(s.getDate() - 7);
  else if (preset === "month") s.setDate(s.getDate() - 30);
  else if (preset === "quarter") s.setDate(s.getDate() - 90);
  else s.setDate(s.getDate() - 30);
  return { start: s.toISOString().split("T")[0], end };
}

export function filterScoresByRange(scores: HistoryScore[], start: string, end: string) {
  return scores.filter((s) => s.date >= start && s.date <= end);
}
