import { db, locationLogs, tasks, goals, pillars, dailyScores, cycles, contactMessages } from "@/lib/db";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { getTodayString, parseScheduleDays } from "@/lib/format";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleGetTasks(args: any, userId: string): Promise<string> {
  const from = args.from || getTodayString();
  const to = args.to || getTodayString();
  const conditions = [eq(tasks.userId, userId), eq(tasks.dismissed, false), gte(tasks.date, from), lte(tasks.date, to)];
  const result = await db.select().from(tasks).where(and(...conditions)).orderBy(desc(tasks.date));
  const lines = result.map(t => {
    const status = t.completed ? "done" : "todo";
    const val = t.completionType !== "checkbox" && t.target ? `${t.value || 0}/${t.target}` : status;
    return `[${t.date}] (id:${t.id}) ${t.name} — ${val}`;
  });
  return lines.join("\n") || "No tasks found for this period.";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleGetGoals(args: any, userId: string): Promise<string> {
  const result = await db.select({
    id: goals.id, name: goals.name, goalType: goals.goalType, status: goals.status,
    startValue: goals.startValue, targetValue: goals.targetValue, currentValue: goals.currentValue,
    unit: goals.unit, startDate: goals.startDate, targetDate: goals.targetDate,
    periodId: goals.periodId, pillarId: goals.pillarId,
    completionType: goals.completionType, dailyTarget: goals.dailyTarget,
    scheduleDays: goals.scheduleDays, autoCreateTasks: goals.autoCreateTasks,
    flexibilityRule: goals.flexibilityRule, limitValue: goals.limitValue,
    pillarName: pillars.name,
  }).from(goals).leftJoin(pillars, eq(goals.pillarId, pillars.id)).where(eq(goals.userId, userId));
  const lines = result.map(g => {
    const parts = [
      `[${g.status}] (id:${g.id}) ${g.name} (${g.goalType}) — ${g.currentValue}/${g.targetValue} ${g.unit}`,
    ];
    if (g.pillarName) parts.push(`pillar: ${g.pillarName} (id:${g.pillarId})`);
    if (g.periodId) parts.push(`cycleId:${g.periodId}`);
    if (g.startDate) parts.push(`${g.startDate} to ${g.targetDate}`);
    if (g.completionType !== 'checkbox') parts.push(`type: ${g.completionType}`);
    if (g.dailyTarget) parts.push(`daily: ${g.dailyTarget}`);
    if (g.scheduleDays) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const days = parseScheduleDays(g.scheduleDays);
      if (days.length > 0) parts.push(`days: ${days.map(d => dayNames[d] || d).join(',')}`);
    }
    if (g.autoCreateTasks) parts.push('auto-tasks');
    if (g.flexibilityRule !== 'must_today') parts.push(`rule: ${g.flexibilityRule}`);
    if (g.limitValue != null) parts.push(`limit: ${g.limitValue}`);
    return parts.join(' | ');
  });
  return lines.join("\n") || "No goals found.";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleGetScores(args: any, userId: string): Promise<string> {
  const from = args.from || daysAgo(7);
  const to = args.to || getTodayString();
  const result = await db.select().from(dailyScores).where(and(eq(dailyScores.userId, userId), gte(dailyScores.date, from), lte(dailyScores.date, to))).orderBy(desc(dailyScores.date));
  const lines = result.map(s => `[${s.date}] Action: ${s.actionScore}%${s.momentumScore != null ? ` | Momentum: ${s.momentumScore}` : ""}`);
  return lines.join("\n") || "No scores found for this period.";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleGetLogs(args: any, userId: string): Promise<string> {
  const from = args.from || daysAgo(7);
  const to = args.to || getTodayString();
  const result = await db.select().from(locationLogs).where(and(eq(locationLogs.userId, userId), gte(locationLogs.date, from), lte(locationLogs.date, to))).orderBy(desc(locationLogs.date), desc(locationLogs.createdAt));
  const lines = result.map(l => `[${l.date}${l.time ? " " + l.time : ""}] ${l.notes || "(no notes)"}`);
  return lines.join("\n") || "No log entries found for this period.";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleGetPillars(args: any, userId: string): Promise<string> {
  const result = await db.select().from(pillars).where(eq(pillars.userId, userId));
  const lines = result.map(p => `(id:${p.id}) ${p.emoji} ${p.name} (${p.defaultBasePoints}pts)${p.description ? ` — ${p.description}` : ""}`);
  return lines.join("\n") || "No pillars found.";
}

export async function handleGetSummary(userId: string): Promise<string> {
  const [taskLines, goalLines, scoreLines, logLines] = await Promise.all([
    handleGetTasks({ from: getTodayString(), to: getTodayString() }, userId),
    handleGetGoals({}, userId),
    handleGetScores({ from: daysAgo(7), to: getTodayString() }, userId),
    handleGetLogs({ from: daysAgo(3), to: getTodayString() }, userId),
  ]);
  return `=== TODAY'S TASKS ===\n${taskLines}\n\n=== GOALS ===\n${goalLines}\n\n=== SCORES (LAST 7 DAYS) ===\n${scoreLines}\n\n=== RECENT LOGS ===\n${logLines}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleGetCycles(args: any, userId: string): Promise<string> {
  const result = await db.select().from(cycles).where(eq(cycles.userId, userId)).orderBy(desc(cycles.startDate));
  const lines = result.map(c =>
    `(id:${c.id}) ${c.name} | ${c.startDate} to ${c.endDate}${c.theme ? ` | theme: ${c.theme}` : ""}${c.vision ? ` | vision: ${c.vision}` : ""}`
  );
  return lines.join("\n") || "No cycles found.";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleGetFeedback(args: any, userId: string): Promise<string> {
  const conditions = [eq(contactMessages.userId, userId)];
  if (args.status) conditions.push(eq(contactMessages.status, args.status));
  const result = await db.select().from(contactMessages).where(and(...conditions)).orderBy(desc(contactMessages.createdAt));
  const lines = result.map(m =>
    `(id:${m.id}) [${m.status}] ${m.topic} — ${m.message}${m.read ? "" : " (unread)"}`
  );
  return lines.join("\n") || "No feedback messages found.";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleGetTaskDetails(args: any, userId: string): Promise<string> {
  const taskId = parseInt(args.taskId, 10);
  if (isNaN(taskId) || taskId <= 0) return "Error: taskId is required.";

  const [task] = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
  if (!task) return "Error: Task not found.";

  // Get schedule info if linked
  let frequency = 'adhoc';
  let customDays: string | null = null;
  let repeatInterval: number | null = null;
  let schedEndDate: string | null = null;
  if (task.scheduleId) {
    const { taskSchedules } = await import("@/lib/db");
    const [sched] = await db.select({ frequency: taskSchedules.frequency, customDays: taskSchedules.customDays, repeatInterval: taskSchedules.repeatInterval, endDate: taskSchedules.endDate })
      .from(taskSchedules).where(eq(taskSchedules.id, task.scheduleId));
    if (sched) { frequency = sched.frequency; customDays = sched.customDays; repeatInterval = sched.repeatInterval; schedEndDate = sched.endDate; }
  }

  // Get pillar name if linked
  let pillarName: string | null = null;
  if (task.pillarId) {
    const [p] = await db.select({ name: pillars.name }).from(pillars).where(eq(pillars.id, task.pillarId));
    if (p) pillarName = p.name;
  }

  // Get goal name if linked
  let goalName: string | null = null;
  if (task.goalId) {
    const [g] = await db.select({ name: goals.name }).from(goals).where(eq(goals.id, task.goalId));
    if (g) goalName = g.name;
  }

  const lines = [
    `Task: ${task.name} (id:${task.id})`,
    task.description ? `Description: ${task.description}` : null,
    `Status: ${task.completed ? 'done' : task.skipped ? 'skipped' : 'todo'}`,
    `Date: ${task.date || '(no date)'}`,
    `Type: ${task.completionType} | Frequency: ${frequency}${repeatInterval ? ` (every ${repeatInterval} ${frequency === 'interval' ? 'days' : frequency === 'monthly' ? 'months' : 'days'})` : ''}`,
    customDays ? `Schedule days: ${(() => { const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']; const days = parseScheduleDays(customDays); return frequency === 'monthly' ? days.map(d => `${d}${d===1?'st':d===2?'nd':d===3?'rd':'th'}`).join(', ') : days.map(d => dayNames[d] || d).join(', '); })()}` : null,
    schedEndDate ? `End date: ${schedEndDate}` : null,
    `Target: ${task.target ?? 'none'} | Value: ${task.value ?? 0} | Unit: ${task.unit || 'none'}`,
    `Points: ${task.pointsEarned}/${task.basePoints} | Flexibility: ${task.flexibilityRule}`,
    `Pillar: ${pillarName ? `${pillarName} (id:${task.pillarId})` : 'none'}`,
    `Goal: ${goalName ? `${goalName} (id:${task.goalId})` : 'none'}`,
    `Schedule: ${task.scheduleId ? `id:${task.scheduleId}` : 'none'}`,
    `Highlighted: ${task.isHighlighted} | Dismissed: ${task.dismissed}`,
    task.limitValue != null ? `Limit: ${task.limitValue}` : null,
    task.completedAt ? `Completed at: ${task.completedAt.toISOString()}` : null,
  ].filter(Boolean);

  return lines.join('\n');
}
