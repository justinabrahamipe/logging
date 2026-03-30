type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" | "DD-MM-YYYY" | "MM-DD-YYYY";
type TimeFormat = "12h" | "24h";

export function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

export function getYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

export function formatDate(dateStr: string, format: DateFormat = "DD/MM/YYYY"): string {
  const d = new Date(dateStr + (dateStr.includes("T") ? "" : "T12:00:00"));
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  switch (format) {
    case "DD/MM/YYYY": return `${day}/${month}/${year}`;
    case "MM/DD/YYYY": return `${month}/${day}/${year}`;
    case "YYYY-MM-DD": return `${year}-${month}-${day}`;
    case "DD-MM-YYYY": return `${day}-${month}-${year}`;
    case "MM-DD-YYYY": return `${month}-${day}-${year}`;
  }
}

export function formatTime(dateStr: string, format: TimeFormat = "12h"): string {
  const d = new Date(dateStr);
  if (format === "12h") {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function formatDateTime(dateStr: string, dateFormat: DateFormat = "DD/MM/YYYY", timeFormat: TimeFormat = "12h"): string {
  return `${formatDate(dateStr, dateFormat)} ${formatTime(dateStr, timeFormat)}`;
}

export function formatRelativeDate(dateStr: string, dateFormat: DateFormat = "DD/MM/YYYY"): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + (dateStr.includes("T") ? "" : "T12:00:00"));
  d.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  return formatDate(dateStr, dateFormat);
}
