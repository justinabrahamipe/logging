import { NextRequest } from "next/server";
import { db, locationLogs, tasks, goals, pillars, dailyScores, userPreferences, taskSchedules, activityLog, cycles, contactMessages } from "@/lib/db";
import { eq, and, desc, gte, lte, or, gt } from "drizzle-orm";
import { calculateTaskScore } from "@/lib/scoring";
import { saveDailyScore } from "@/lib/save-daily-score";
import { createAutoLog } from "@/lib/auto-log";
import { ensureUpcomingTasks, invalidateTaskCache, generateGoalTasks } from "@/lib/ensure-upcoming-tasks";

const SERVER_INFO = {
  name: "grind-console",
  version: "1.0.0",
};

// Track active sessions: sessionId -> userId
const sessions = new Map<string, string>();

const TOOLS = [
  {
    name: "get_tasks",
    description: "Get tasks for a date range. Returns task name, completion status, value, target, and date.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Start date (YYYY-MM-DD). Defaults to today." },
        to: { type: "string", description: "End date (YYYY-MM-DD). Defaults to today." },
      },
    },
  },
  {
    name: "get_goals",
    description: "Get all goals with their progress, type (habitual/target/outcome), status, and linked pillar.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_scores",
    description: "Get daily action scores and momentum for a date range.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Start date (YYYY-MM-DD). Defaults to 7 days ago." },
        to: { type: "string", description: "End date (YYYY-MM-DD). Defaults to today." },
      },
    },
  },
  {
    name: "get_logs",
    description: "Get log entries (user notes, auto-logged task completions, goal changes, etc.) for a date range.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Start date (YYYY-MM-DD). Defaults to 7 days ago." },
        to: { type: "string", description: "End date (YYYY-MM-DD). Defaults to today." },
      },
    },
  },
  {
    name: "get_pillars",
    description: "Get life pillars (categories) with their default base points and descriptions.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_summary",
    description: "Get a comprehensive summary of today's tasks, active goals, recent scores, and recent logs.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "complete_task",
    description: "Mark a task as complete or update its value. Use get_tasks first to find the task ID.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "number", description: "The task instance ID." },
        value: { type: "number", description: "The value to set (for numeric tasks). Omit for checkbox tasks." },
        completed: { type: "boolean", description: "Whether the task is completed. Defaults to true." },
      },
      required: ["taskId"],
    },
  },
  {
    name: "add_log",
    description: "Add a log entry (note/journal) for a given date.",
    inputSchema: {
      type: "object",
      properties: {
        notes: { type: "string", description: "The log text/notes." },
        date: { type: "string", description: "Date for the log (YYYY-MM-DD). Defaults to today." },
        time: { type: "string", description: "Time for the log (HH:MM). Defaults to current time." },
        latitude: { type: "number", description: "Latitude (-90 to 90). Defaults to 0." },
        longitude: { type: "number", description: "Longitude (-180 to 180). Defaults to 0." },
      },
      required: ["notes"],
    },
  },
  {
    name: "create_task",
    description: "Create a new task. Can be adhoc (one-time) or recurring (daily/weekly/custom).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Task name." },
        pillarId: { type: "number", description: "Pillar ID to group under (optional)." },
        completionType: { type: "string", description: "One of: checkbox, numeric, duration. Defaults to checkbox." },
        target: { type: "number", description: "Target value for numeric/duration tasks." },
        unit: { type: "string", description: "Unit label (e.g. 'minutes', 'pages')." },
        frequency: { type: "string", description: "One of: adhoc, daily, weekdays, weekends, custom. Defaults to adhoc." },
        customDays: { type: "string", description: "Comma-separated days (mon,tue,wed,...) for custom frequency." },
        basePoints: { type: "number", description: "Points for completing the task. Defaults to 10." },
        goalId: { type: "number", description: "Goal ID to link this task to (optional). Use get_goals to find the ID." },
        periodId: { type: "number", description: "Cycle/period ID to link to (optional)." },
        flexibilityRule: { type: "string", description: "One of: must_today, at_least, limit_avoid. Defaults to must_today." },
        limitValue: { type: "number", description: "Limit value for limit_avoid tasks (max allowed)." },
        date: { type: "string", description: "Date for adhoc tasks (YYYY-MM-DD). Omit for a no-date task that appears on today's view until completed." },
      },
      required: ["name"],
    },
  },
  {
    name: "get_task_details",
    description: "Get full details of a specific task including schedule info, goal link, points, and completion state.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "number", description: "The task instance ID." },
      },
      required: ["taskId"],
    },
  },
  {
    name: "edit_task",
    description: "Edit an existing task's properties. Use get_tasks first to find the task ID.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "number", description: "The task instance ID to edit." },
        name: { type: "string", description: "New task name." },
        pillarId: { type: "number", description: "New pillar ID." },
        completionType: { type: "string", description: "One of: checkbox, numeric, duration." },
        target: { type: "number", description: "New target value." },
        unit: { type: "string", description: "New unit label." },
        basePoints: { type: "number", description: "New base points." },
        date: { type: "string", description: "New date (YYYY-MM-DD)." },
        goalId: { type: "number", description: "Goal ID to link to. Pass 0 to unlink." },
        periodId: { type: "number", description: "Cycle/period ID. Pass 0 to unlink." },
        flexibilityRule: { type: "string", description: "One of: must_today, at_least, limit_avoid." },
        limitValue: { type: "number", description: "Limit value for limit_avoid rule." },
      },
      required: ["taskId"],
    },
  },
  {
    name: "create_goal",
    description: "Create a new goal. Types: outcome (track a measurable result), target (accumulate toward a number), habitual (build a daily habit).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Goal name." },
        goalType: { type: "string", description: "One of: outcome, target, habitual. Defaults to outcome." },
        targetValue: { type: "number", description: "Target value to reach (required for outcome/target goals)." },
        unit: { type: "string", description: "Unit of measurement (e.g. 'kg', 'pages', 'days'). Defaults to 'days'." },
        startValue: { type: "number", description: "Starting value. Defaults to 0." },
        pillarId: { type: "number", description: "Pillar ID to link to (optional)." },
        periodId: { type: "number", description: "Cycle/period ID to link to (optional). Use create_cycle first to get the ID." },
        startDate: { type: "string", description: "Start date (YYYY-MM-DD)." },
        targetDate: { type: "string", description: "Target/deadline date (YYYY-MM-DD)." },
        completionType: { type: "string", description: "One of: checkbox, count, numeric. Defaults to checkbox." },
        dailyTarget: { type: "number", description: "Per-session target for habitual/target goals." },
        autoCreateTasks: { type: "boolean", description: "Auto-create daily tasks for this goal. Defaults to false." },
        scheduleDays: { type: "array", items: { type: "number" }, description: "Days of week to schedule (0=Sun, 1=Mon, ..., 6=Sat)." },
        flexibilityRule: { type: "string", description: "One of: must_today, at_least, limit_avoid. Defaults to must_today." },
        limitValue: { type: "number", description: "Limit value for limit_avoid goals." },
      },
      required: ["name"],
    },
  },
  {
    name: "edit_goal",
    description: "Edit an existing goal's properties. Use get_goals first to find the goal ID.",
    inputSchema: {
      type: "object",
      properties: {
        goalId: { type: "number", description: "The goal ID to edit." },
        name: { type: "string", description: "New goal name." },
        pillarId: { type: "number", description: "New pillar ID." },
        startValue: { type: "number", description: "New start value." },
        targetValue: { type: "number", description: "New target value." },
        unit: { type: "string", description: "New unit." },
        startDate: { type: "string", description: "New start date (YYYY-MM-DD)." },
        targetDate: { type: "string", description: "New target date (YYYY-MM-DD)." },
        status: { type: "string", description: "One of: active, completed, abandoned." },
        periodId: { type: "number", description: "Cycle/period ID to link to. Pass 0 to unlink." },
        dailyTarget: { type: "number", description: "New per-session target." },
        completionType: { type: "string", description: "One of: checkbox, count, numeric." },
        goalType: { type: "string", description: "One of: outcome, target, habitual." },
        scheduleDays: { type: "array", items: { type: "number" }, description: "Days of week (0=Sun..6=Sat)." },
        autoCreateTasks: { type: "boolean", description: "Auto-create daily tasks." },
        flexibilityRule: { type: "string", description: "One of: must_today, at_least, limit_avoid." },
        limitValue: { type: "number", description: "Limit value for limit_avoid." },
      },
      required: ["goalId"],
    },
  },
  {
    name: "delete_task",
    description: "Delete a task. Goal-linked tasks are dismissed instead of deleted to prevent auto-recreation. Use get_tasks first to find the task ID.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "number", description: "The task ID to delete." },
      },
      required: ["taskId"],
    },
  },
  {
    name: "create_cycle",
    description: "Create a new cycle/period (e.g. monthly sprint). Goals can be linked to cycles via periodId.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Cycle name (e.g. 'April 2026')." },
        startDate: { type: "string", description: "Start date (YYYY-MM-DD)." },
        endDate: { type: "string", description: "End date (YYYY-MM-DD)." },
        vision: { type: "string", description: "Vision statement for this cycle (optional)." },
        theme: { type: "string", description: "Theme for this cycle (optional)." },
      },
      required: ["name", "startDate", "endDate"],
    },
  },
  {
    name: "create_pillar",
    description: "Create a new life pillar (category for grouping tasks and goals).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Pillar name (e.g. 'Health', 'Career')." },
        emoji: { type: "string", description: "Emoji icon. Defaults to '📌'." },
        color: { type: "string", description: "Hex color (e.g. '#3B82F6'). Defaults to blue." },
        defaultBasePoints: { type: "number", description: "Default base points for tasks in this pillar (default 10)." },
        description: { type: "string", description: "Description of this pillar (optional)." },
      },
      required: ["name"],
    },
  },
  {
    name: "edit_pillar",
    description: "Edit an existing pillar. Use get_pillars to find the ID.",
    inputSchema: {
      type: "object",
      properties: {
        pillarId: { type: "number", description: "The pillar ID to edit." },
        name: { type: "string", description: "New name." },
        emoji: { type: "string", description: "New emoji." },
        color: { type: "string", description: "New hex color." },
        defaultBasePoints: { type: "number", description: "Default base points for tasks in this pillar." },
        description: { type: "string", description: "New description." },
      },
      required: ["pillarId"],
    },
  },
  {
    name: "edit_cycle",
    description: "Edit an existing cycle/period. Use get_cycles to find the ID.",
    inputSchema: {
      type: "object",
      properties: {
        cycleId: { type: "number", description: "The cycle ID to edit." },
        name: { type: "string", description: "New name." },
        startDate: { type: "string", description: "New start date (YYYY-MM-DD)." },
        endDate: { type: "string", description: "New end date (YYYY-MM-DD)." },
        vision: { type: "string", description: "New vision statement." },
        theme: { type: "string", description: "New theme." },
      },
      required: ["cycleId"],
    },
  },
  {
    name: "get_cycles",
    description: "Get all cycles/periods with their dates, vision, and theme.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_feedback",
    description: "Get feedback/contact messages submitted by the user.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter by status: todo, in_progress, done. Returns all if omitted." },
      },
    },
  },
];

async function authenticate(request: NextRequest): Promise<string | null> {
  // Support Bearer token from Authorization header (used by Claude custom connectors)
  const authHeader = request.headers.get("authorization");
  const bearerKey = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  // Fall back to ?key= query param
  const key = bearerKey || request.nextUrl.searchParams.get("key");
  if (!key) return null;

  const [pref] = await db
    .select({ userId: userPreferences.userId })
    .from(userPreferences)
    .where(eq(userPreferences.apiKey, key));
  return pref?.userId || null;
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeTool(userId: string, name: string, args: Record<string, any>): Promise<string> {
  switch (name) {
    case "get_tasks": {
      const from = args.from || today();
      const to = args.to || today();
      const conditions = [eq(tasks.userId, userId), eq(tasks.dismissed, false), gte(tasks.date, from), lte(tasks.date, to)];
      const result = await db.select().from(tasks).where(and(...conditions)).orderBy(desc(tasks.date));
      const lines = result.map(t => {
        const status = t.completed ? "done" : "todo";
        const val = t.completionType !== "checkbox" && t.target ? `${t.value || 0}/${t.target}` : status;
        return `[${t.date}] (id:${t.id}) ${t.name} — ${val}`;
      });
      return lines.join("\n") || "No tasks found for this period.";
    }
    case "get_goals": {
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
          try {
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const days = JSON.parse(g.scheduleDays) as number[];
            parts.push(`days: ${days.map(d => dayNames[d] || d).join(',')}`);
          } catch { parts.push(`days: ${g.scheduleDays}`); }
        }
        if (g.autoCreateTasks) parts.push('auto-tasks');
        if (g.flexibilityRule !== 'must_today') parts.push(`rule: ${g.flexibilityRule}`);
        if (g.limitValue != null) parts.push(`limit: ${g.limitValue}`);
        return parts.join(' | ');
      });
      return lines.join("\n") || "No goals found.";
    }
    case "get_scores": {
      const from = args.from || daysAgo(7);
      const to = args.to || today();
      const result = await db.select().from(dailyScores).where(and(eq(dailyScores.userId, userId), gte(dailyScores.date, from), lte(dailyScores.date, to))).orderBy(desc(dailyScores.date));
      const lines = result.map(s => `[${s.date}] Action: ${s.actionScore}%${s.momentumScore != null ? ` | Momentum: ${s.momentumScore}` : ""}`);
      return lines.join("\n") || "No scores found for this period.";
    }
    case "get_logs": {
      const from = args.from || daysAgo(7);
      const to = args.to || today();
      const result = await db.select().from(locationLogs).where(and(eq(locationLogs.userId, userId), gte(locationLogs.date, from), lte(locationLogs.date, to))).orderBy(desc(locationLogs.date), desc(locationLogs.createdAt));
      const lines = result.map(l => `[${l.date}${l.time ? " " + l.time : ""}] ${l.notes || "(no notes)"}`);
      return lines.join("\n") || "No log entries found for this period.";
    }
    case "get_pillars": {
      const result = await db.select().from(pillars).where(eq(pillars.userId, userId));
      const lines = result.map(p => `(id:${p.id}) ${p.emoji} ${p.name} (${p.defaultBasePoints}pts)${p.description ? ` — ${p.description}` : ""}`);
      return lines.join("\n") || "No pillars found.";
    }
    case "get_summary": {
      const [taskLines, goalLines, scoreLines, logLines] = await Promise.all([
        executeTool(userId, "get_tasks", { from: today(), to: today() }),
        executeTool(userId, "get_goals", {}),
        executeTool(userId, "get_scores", { from: daysAgo(7), to: today() }),
        executeTool(userId, "get_logs", { from: daysAgo(3), to: today() }),
      ]);
      return `=== TODAY'S TASKS ===\n${taskLines}\n\n=== GOALS ===\n${goalLines}\n\n=== SCORES (LAST 7 DAYS) ===\n${scoreLines}\n\n=== RECENT LOGS ===\n${logLines}`;
    }
    case "complete_task": {
      const taskId = parseInt(args.taskId);
      if (!taskId) return "Error: taskId is required.";

      const [task] = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
      if (!task) return "Error: Task not found.";

      // Only allow changes for today, yesterday, and future
      const yest = new Date(); yest.setDate(yest.getDate() - 1);
      if (task.date < yest.toISOString().split('T')[0]) {
        return "Error: Cannot modify tasks older than yesterday.";
      }

      const completionValue = args.value != null ? parseFloat(args.value) : (task.completionType === 'checkbox' ? 1 : 0);
      const targetReached = task.target != null && task.target > 0 && completionValue >= task.target;
      const isCompleted = args.completed != null ? args.completed === "true" || args.completed === true : (
        task.completionType === 'checkbox' ? true : targetReached
      );

      const pointsEarned = calculateTaskScore(
        { id: task.id, pillarId: task.pillarId, completionType: task.completionType, target: task.target, basePoints: task.basePoints, flexibilityRule: task.flexibilityRule, limitValue: task.limitValue },
        { taskId: task.id, completed: isCompleted, value: completionValue }
      );

      const previousValue = task.value ?? null;
      const pointsBefore = task.pointsEarned ?? 0;

      await db.update(tasks).set({
        completed: isCompleted,
        value: completionValue,
        pointsEarned,
        completedAt: isCompleted ? new Date() : null,
        timerStartedAt: null,
        skipped: false,
      }).where(eq(tasks.id, taskId));

      // Activity log
      let action = 'complete';
      if (previousValue !== null) {
        if (completionValue > (previousValue ?? 0)) action = 'add';
        else if (completionValue < (previousValue ?? 0)) action = 'subtract';
        else action = 'adjust';
      }
      await db.insert(activityLog).values({
        userId, taskId: task.id, pillarId: task.pillarId, action,
        previousValue, newValue: completionValue,
        delta: completionValue - (previousValue ?? 0),
        pointsBefore, pointsAfter: pointsEarned,
        pointsDelta: pointsEarned - pointsBefore,
        source: 'manual',
      });

      // Auto-log
      if (isCompleted && !task.completed) {
        const valueStr = completionValue > 0 && task.completionType !== 'checkbox' ? ` (${completionValue}${task.unit ? ' ' + task.unit : ''})` : '';
        await createAutoLog(userId, `✅ ${task.name}${valueStr}`, task.date || today());
      }

      // Update linked goal
      if (task.goalId) {
        const [linkedGoal] = await db.select().from(goals).where(and(eq(goals.id, task.goalId), eq(goals.userId, userId)));
        if (linkedGoal) {
          let newTotal: number;
          if (linkedGoal.goalType === 'outcome') {
            newTotal = isCompleted && completionValue > 0 ? completionValue : linkedGoal.currentValue;
          } else {
            const allWithProgress = await db.select({ value: tasks.value }).from(tasks)
              .where(and(eq(tasks.goalId, task.goalId), or(eq(tasks.completed, true), gt(tasks.value, 0))));
            newTotal = allWithProgress.reduce((sum, t) => sum + (t.value ?? 0), 0);
          }
          await db.update(goals).set({ currentValue: newTotal }).where(eq(goals.id, linkedGoal.id));

          // Auto-complete target goals when target is reached
          if (linkedGoal.goalType === 'target' && linkedGoal.status === 'active') {
            const isDecrease = linkedGoal.targetValue < linkedGoal.startValue;
            const reached = isDecrease ? newTotal <= linkedGoal.targetValue : newTotal >= linkedGoal.targetValue;
            if (reached) {
              await db.update(goals).set({ status: 'completed', currentValue: linkedGoal.targetValue }).where(eq(goals.id, linkedGoal.id));
              const remaining = await db.select({ id: tasks.id }).from(tasks)
                .where(and(eq(tasks.goalId, linkedGoal.id), eq(tasks.userId, userId), eq(tasks.completed, false)));
              for (const r of remaining) {
                await db.delete(tasks).where(eq(tasks.id, r.id));
              }
              await createAutoLog(userId, `🏆 Goal auto-completed: ${linkedGoal.name}`);
            }
          }
        }
      }

      // Recalculate daily score
      const taskDate = task.date || today();
      if (taskDate) await saveDailyScore(userId, taskDate);

      const status = isCompleted ? "completed" : "updated";
      const valStr = task.completionType !== 'checkbox' ? ` (value: ${completionValue})` : '';
      return `Task "${task.name}" ${status}${valStr}. Points: ${pointsEarned}.`;
    }

    case "add_log": {
      const notes = args.notes;
      if (!notes) return "Error: notes is required.";

      const date = args.date || today();
      const now = new Date();
      const time = args.time || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const latitude = args.latitude != null ? parseFloat(args.latitude) : 0;
      const longitude = args.longitude != null ? parseFloat(args.longitude) : 0;

      await db.insert(locationLogs).values({
        userId,
        latitude,
        longitude,
        date,
        time,
        notes,
      });

      const locStr = (latitude !== 0 || longitude !== 0) ? ` at ${latitude}, ${longitude}` : '';
      return `Log added for ${date} at ${time}${locStr}: "${notes}"`;
    }

    case "create_task": {
      const taskName = args.name;
      if (!taskName) return "Error: name is required.";

      const frequency = args.frequency || 'adhoc';
      const isRecurring = frequency !== 'adhoc';
      const completionType = args.completionType || 'checkbox';
      const basePoints = args.basePoints ? parseInt(args.basePoints) : 10;
      const target = args.target ? parseFloat(args.target) : null;
      const pillarId = args.pillarId ? parseInt(args.pillarId) : null;

      if (pillarId) {
        const [p] = await db.select().from(pillars).where(and(eq(pillars.id, pillarId), eq(pillars.userId, userId)));
        if (!p) return "Error: Pillar not found.";
      }

      if (isRecurring) {
        const [schedule] = await db.insert(taskSchedules).values({
          pillarId,
          userId,
          name: taskName,
          completionType,
          target,
          unit: args.unit || null,
          flexibilityRule: args.flexibilityRule || 'must_today',
          limitValue: args.limitValue ?? null,
          frequency,
          customDays: args.customDays || null,
          repeatInterval: null,
          basePoints,
          goalId: args.goalId ? parseInt(args.goalId) : null,
          periodId: args.periodId ? parseInt(args.periodId) : null,
          startDate: null,
        }).returning();

        invalidateTaskCache(userId);
        await ensureUpcomingTasks(userId);
        await createAutoLog(userId, `➕ Task created: ${taskName}`);
        return `Recurring task "${taskName}" created (${frequency}). Schedule ID: ${schedule.id}.`;
      } else {
        const taskDate = args.date !== undefined ? args.date : '';
        const [task] = await db.insert(tasks).values({
          pillarId,
          userId,
          name: taskName,
          completionType,
          target,
          unit: args.unit || null,
          flexibilityRule: args.flexibilityRule || 'must_today',
          limitValue: args.limitValue ?? null,
          basePoints,
          goalId: args.goalId ? parseInt(args.goalId) : null,
          periodId: args.periodId ? parseInt(args.periodId) : null,
          date: taskDate,
        }).returning();

        await createAutoLog(userId, `➕ Task created: ${taskName}`);
        return `Task "${taskName}" created${taskDate ? ` for ${taskDate}` : ' (no date)'}. Task ID: ${task.id}.`;
      }
    }

    case "get_task_details": {
      const taskId = parseInt(args.taskId);
      if (!taskId) return "Error: taskId is required.";

      const [task] = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
      if (!task) return "Error: Task not found.";

      // Get schedule info if linked
      let frequency = 'adhoc';
      let customDays: string | null = null;
      if (task.scheduleId) {
        const [sched] = await db.select({ frequency: taskSchedules.frequency, customDays: taskSchedules.customDays })
          .from(taskSchedules).where(eq(taskSchedules.id, task.scheduleId));
        if (sched) { frequency = sched.frequency; customDays = sched.customDays; }
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
        `Status: ${task.completed ? 'done' : task.skipped ? 'skipped' : 'todo'}`,
        `Date: ${task.date || '(no date)'}`,
        `Type: ${task.completionType} | Frequency: ${frequency}`,
        `Target: ${task.target ?? 'none'} | Value: ${task.value ?? 0} | Unit: ${task.unit || 'none'}`,
        `Points: ${task.pointsEarned}/${task.basePoints} | Flexibility: ${task.flexibilityRule}`,
        `Pillar: ${pillarName ? `${pillarName} (id:${task.pillarId})` : 'none'}`,
        `Goal: ${goalName ? `${goalName} (id:${task.goalId})` : 'none'}`,
        `Schedule: ${task.scheduleId ? `id:${task.scheduleId}` : 'none'}${customDays ? ` | Days: ${customDays}` : ''}`,
        `Highlighted: ${task.isHighlighted} | Dismissed: ${task.dismissed}`,
        task.limitValue != null ? `Limit: ${task.limitValue}` : null,
        task.completedAt ? `Completed at: ${task.completedAt.toISOString()}` : null,
      ].filter(Boolean);

      return lines.join('\n');
    }

    case "edit_task": {
      const taskId = parseInt(args.taskId);
      if (!taskId) return "Error: taskId is required.";

      const [task] = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
      if (!task) return "Error: Task not found.";

      // Only allow edits for today, yesterday, and future
      const yest2 = new Date(); yest2.setDate(yest2.getDate() - 1);
      if (task.date < yest2.toISOString().split('T')[0]) {
        return "Error: Cannot modify tasks older than yesterday.";
      }

      const updateData: Record<string, unknown> = {};
      if (args.name !== undefined) updateData.name = args.name;
      if (args.pillarId !== undefined) updateData.pillarId = args.pillarId || null;
      if (args.completionType !== undefined) updateData.completionType = args.completionType;
      if (args.target !== undefined) updateData.target = args.target;
      if (args.unit !== undefined) updateData.unit = args.unit || null;
      if (args.basePoints !== undefined) updateData.basePoints = args.basePoints;
      if (args.date !== undefined) updateData.date = args.date;
      if (args.goalId !== undefined) updateData.goalId = args.goalId === 0 ? null : args.goalId;
      if (args.flexibilityRule !== undefined) updateData.flexibilityRule = args.flexibilityRule;
      if (args.limitValue !== undefined) updateData.limitValue = args.limitValue ?? null;
      if (args.periodId !== undefined) updateData.periodId = args.periodId === 0 ? null : args.periodId;

      if (Object.keys(updateData).length === 0) return "Error: No fields to update.";

      await db.update(tasks).set(updateData).where(eq(tasks.id, taskId));

      // Propagate to schedule if linked
      if (task.scheduleId) {
        const scheduleUpdate: Record<string, unknown> = {};
        if (args.name !== undefined) scheduleUpdate.name = args.name;
        if (args.pillarId !== undefined) scheduleUpdate.pillarId = args.pillarId || null;
        if (args.completionType !== undefined) scheduleUpdate.completionType = args.completionType;
        if (args.target !== undefined) scheduleUpdate.target = args.target;
        if (args.unit !== undefined) scheduleUpdate.unit = args.unit || null;
        if (args.basePoints !== undefined) scheduleUpdate.basePoints = args.basePoints;
        if (args.date !== undefined) scheduleUpdate.startDate = args.date;
        if (args.goalId !== undefined) scheduleUpdate.goalId = args.goalId === 0 ? null : args.goalId;
        if (args.periodId !== undefined) scheduleUpdate.periodId = args.periodId === 0 ? null : args.periodId;
        if (args.flexibilityRule !== undefined) scheduleUpdate.flexibilityRule = args.flexibilityRule;
        if (args.limitValue !== undefined) scheduleUpdate.limitValue = args.limitValue ?? null;
        if (Object.keys(scheduleUpdate).length > 0) {
          await db.update(taskSchedules).set(scheduleUpdate).where(eq(taskSchedules.id, task.scheduleId));
        }
      }

      // Recalculate scores if date changed
      if (args.date !== undefined && task.date && args.date !== task.date) {
        await saveDailyScore(userId, task.date);
        if (args.date) await saveDailyScore(userId, args.date);
      }

      await createAutoLog(userId, `✏️ Task updated: ${args.name || task.name}`);
      return `Task "${args.name || task.name}" updated.`;
    }

    case "create_goal": {
      const goalName = args.name;
      if (!goalName) return "Error: name is required.";

      const goalType = args.goalType || 'outcome';
      const isActivityGoal = goalType === 'habitual' || goalType === 'target';

      if (!isActivityGoal && args.targetValue == null) {
        return "Error: targetValue is required for outcome/target goals.";
      }

      const pillarId = args.pillarId ? parseInt(args.pillarId) : null;
      if (pillarId) {
        const [p] = await db.select().from(pillars).where(and(eq(pillars.id, pillarId), eq(pillars.userId, userId)));
        if (!p) return "Error: Pillar not found.";
      }

      let startDate = args.startDate || null;
      let targetDate = args.targetDate || null;

      // For activity goals with a period, derive dates from the cycle
      if (isActivityGoal && args.periodId) {
        const [cycle] = await db.select().from(cycles).where(eq(cycles.id, parseInt(args.periodId)));
        if (cycle) {
          if (!startDate) startDate = cycle.startDate;
          if (!targetDate) targetDate = cycle.endDate;
        }
      }

      const startValue = args.startValue ?? 0;
      const scheduleDays = args.scheduleDays || null;

      const [goal] = await db.insert(goals).values({
        userId,
        name: goalName,
        startValue,
        targetValue: args.targetValue ?? 0,
        currentValue: startValue,
        unit: args.unit || 'days',
        pillarId,
        startDate,
        targetDate,
        periodId: args.periodId ? parseInt(args.periodId) : null,
        goalType,
        completionType: args.completionType || 'checkbox',
        dailyTarget: args.dailyTarget ?? null,
        scheduleDays: scheduleDays ? JSON.stringify(scheduleDays) : null,
        autoCreateTasks: args.autoCreateTasks || false,
        flexibilityRule: args.flexibilityRule || 'must_today',
        limitValue: args.limitValue ?? null,
      }).returning();

      // Generate all tasks upfront for the full goal date range
      if (args.autoCreateTasks) {
        await generateGoalTasks(userId, goal.id);
      }

      await createAutoLog(userId, `📌 Goal created: ${goalName}`);
      return `Goal "${goalName}" created (${goalType}). Goal ID: ${goal.id}.`;
    }

    case "edit_goal": {
      const goalId = parseInt(args.goalId);
      if (!goalId) return "Error: goalId is required.";

      const [existing] = await db.select().from(goals).where(and(eq(goals.id, goalId), eq(goals.userId, userId)));
      if (!existing) return "Error: Goal not found.";

      const updateData: Record<string, unknown> = {};
      if (args.name !== undefined) updateData.name = args.name;
      if (args.pillarId !== undefined) updateData.pillarId = args.pillarId || null;
      if (args.startValue !== undefined) updateData.startValue = args.startValue;
      if (args.targetValue !== undefined) updateData.targetValue = args.targetValue;
      if (args.unit !== undefined) updateData.unit = args.unit;
      if (args.startDate !== undefined) updateData.startDate = args.startDate || null;
      if (args.targetDate !== undefined) updateData.targetDate = args.targetDate || null;
      if (args.status !== undefined) updateData.status = args.status;
      if (args.periodId !== undefined) updateData.periodId = args.periodId === 0 ? null : args.periodId;
      if (args.dailyTarget !== undefined) updateData.dailyTarget = args.dailyTarget ?? null;
      if (args.completionType !== undefined) updateData.completionType = args.completionType;
      if (args.goalType !== undefined) updateData.goalType = args.goalType;
      if (args.scheduleDays !== undefined) updateData.scheduleDays = args.scheduleDays ? JSON.stringify(args.scheduleDays) : null;
      if (args.autoCreateTasks !== undefined) updateData.autoCreateTasks = args.autoCreateTasks;
      if (args.flexibilityRule !== undefined) updateData.flexibilityRule = args.flexibilityRule;
      if (args.limitValue !== undefined) updateData.limitValue = args.limitValue ?? null;

      if (Object.keys(updateData).length === 0) return "Error: No fields to update.";

      // Auto-complete target/outcome goals when marked completed
      if (args.status === 'completed' && (existing.goalType === 'target' || existing.goalType === 'outcome')) {
        updateData.currentValue = existing.targetValue;
      }

      await db.update(goals).set(updateData).where(and(eq(goals.id, goalId), eq(goals.userId, userId)));

      // When completed/abandoned, delete future uncompleted tasks
      if (args.status === 'completed' || args.status === 'abandoned') {
        const todayStr = today();
        const futureTasks = await db.select({ id: tasks.id, date: tasks.date }).from(tasks)
          .where(and(eq(tasks.goalId, goalId), eq(tasks.userId, userId), eq(tasks.completed, false)));
        for (const t of futureTasks) {
          if (t.date > todayStr) {
            await db.delete(tasks).where(eq(tasks.id, t.id));
          }
        }
      }

      // When targetDate is preponed, delete uncompleted tasks beyond the new end date
      if (args.targetDate !== undefined && args.targetDate) {
        const beyondTasks = await db.select({ id: tasks.id, date: tasks.date }).from(tasks)
          .where(and(eq(tasks.goalId, goalId), eq(tasks.userId, userId), eq(tasks.completed, false)));
        for (const t of beyondTasks) {
          if (t.date > args.targetDate) {
            await db.delete(tasks).where(eq(tasks.id, t.id));
          }
        }
      }

      // When scheduleDays changed, delete uncompleted future tasks on removed days
      if (args.scheduleDays !== undefined) {
        const todayStr2 = today();
        const newDays: number[] = args.scheduleDays || [];
        const oldDays: number[] = existing.scheduleDays ? JSON.parse(existing.scheduleDays) : [];
        const removedDays = oldDays.filter((d: number) => !newDays.includes(d));
        if (removedDays.length > 0) {
          const ft = await db.select({ id: tasks.id, date: tasks.date }).from(tasks)
            .where(and(eq(tasks.goalId, goalId), eq(tasks.userId, userId), eq(tasks.completed, false)));
          for (const t of ft) {
            if (t.date >= todayStr2) {
              const dow = new Date(t.date + 'T12:00:00').getDay();
              if (removedDays.includes(dow)) {
                await db.delete(tasks).where(eq(tasks.id, t.id));
              }
            }
          }
        }
      }

      // When autoCreateTasks is turned off, delete future uncompleted tasks
      if (args.autoCreateTasks === false && existing.autoCreateTasks) {
        const todayStr2 = today();
        const ft = await db.select({ id: tasks.id, date: tasks.date }).from(tasks)
          .where(and(eq(tasks.goalId, goalId), eq(tasks.userId, userId), eq(tasks.completed, false)));
        for (const t of ft) {
          if (t.date > todayStr2) {
            await db.delete(tasks).where(eq(tasks.id, t.id));
          }
        }
      }

      // Generate new tasks for extended range, new days, or toggled-on autoCreateTasks
      const updatedGoalAutoCreate = args.autoCreateTasks !== undefined ? args.autoCreateTasks : existing.autoCreateTasks;
      const updatedGoalStatus = args.status || existing.status;
      const needsRegen = (
        (args.targetDate !== undefined && args.targetDate > (existing.targetDate || '')) ||
        (args.startDate !== undefined) ||
        (args.scheduleDays !== undefined) ||
        (args.autoCreateTasks === true && !existing.autoCreateTasks)
      );
      if (needsRegen && updatedGoalAutoCreate && updatedGoalStatus === 'active') {
        await generateGoalTasks(userId, goalId);
      }

      // Propagate name/pillar/completionType changes to linked tasks
      const propagate: Record<string, unknown> = {};
      if (args.name !== undefined) propagate.name = args.name;
      if (args.pillarId !== undefined) propagate.pillarId = args.pillarId || null;
      if (args.completionType !== undefined) propagate.completionType = args.completionType;
      if (args.unit !== undefined) propagate.unit = args.unit || null;

      if (Object.keys(propagate).length > 0) {
        const todayStr = today();
        const linkedTasks = await db.select().from(tasks)
          .where(and(eq(tasks.goalId, goalId), eq(tasks.userId, userId), eq(tasks.completed, false)));
        for (const t of linkedTasks) {
          if (t.date >= todayStr) {
            await db.update(tasks).set(propagate).where(eq(tasks.id, t.id));
          }
        }
        // Also propagate to schedules
        const scheduleProp: Record<string, unknown> = { ...propagate };
        await db.update(taskSchedules).set(scheduleProp)
          .where(and(eq(taskSchedules.goalId, goalId), eq(taskSchedules.userId, userId)));
      }

      // Auto-log
      const goalName = existing.name;
      if (args.status === 'completed') {
        await createAutoLog(userId, `🏆 Goal completed: ${goalName}`);
      } else if (args.status === 'abandoned') {
        await createAutoLog(userId, `🚫 Goal abandoned: ${goalName}`);
      } else if (args.status === 'active' && existing.status !== 'active') {
        await createAutoLog(userId, `🔄 Goal reactivated: ${goalName}`);
      } else if (args.name && args.name !== goalName) {
        await createAutoLog(userId, `✏️ Goal renamed: ${goalName} → ${args.name}`);
      } else {
        await createAutoLog(userId, `✏️ Goal updated: ${goalName}`);
      }

      return `Goal "${args.name || goalName}" updated.`;
    }

    case "create_pillar": {
      const pillarName = args.name;
      if (!pillarName) return "Error: name is required.";

      const [pillar] = await db.insert(pillars).values({
        userId,
        name: pillarName,
        emoji: args.emoji || '📌',
        color: args.color || '#3B82F6',
        defaultBasePoints: args.defaultBasePoints ?? 10,
        description: args.description || null,
      }).returning();

      await createAutoLog(userId, `📌 Pillar created: ${pillarName}`);
      return `Pillar "${pillarName}" created. Pillar ID: ${pillar.id}.`;
    }

    case "edit_pillar": {
      const pillarId = parseInt(args.pillarId);
      if (!pillarId) return "Error: pillarId is required.";

      const [existing] = await db.select().from(pillars).where(and(eq(pillars.id, pillarId), eq(pillars.userId, userId)));
      if (!existing) return "Error: Pillar not found.";

      const updateData: Record<string, unknown> = {};
      if (args.name !== undefined) updateData.name = args.name;
      if (args.emoji !== undefined) updateData.emoji = args.emoji;
      if (args.color !== undefined) updateData.color = args.color;
      if (args.defaultBasePoints !== undefined) updateData.defaultBasePoints = args.defaultBasePoints;
      if (args.description !== undefined) updateData.description = args.description || null;

      if (Object.keys(updateData).length === 0) return "Error: No fields to update.";

      await db.update(pillars).set(updateData).where(and(eq(pillars.id, pillarId), eq(pillars.userId, userId)));
      await createAutoLog(userId, `✏️ Pillar updated: ${args.name || existing.name}`);
      return `Pillar "${args.name || existing.name}" updated.`;
    }

    case "edit_cycle": {
      const cycleId = parseInt(args.cycleId);
      if (!cycleId) return "Error: cycleId is required.";

      const [existing] = await db.select().from(cycles).where(and(eq(cycles.id, cycleId), eq(cycles.userId, userId)));
      if (!existing) return "Error: Cycle not found.";

      const updateData: Record<string, unknown> = {};
      if (args.name !== undefined) updateData.name = args.name;
      if (args.startDate !== undefined) updateData.startDate = args.startDate;
      if (args.endDate !== undefined) updateData.endDate = args.endDate;
      if (args.vision !== undefined) updateData.vision = args.vision || null;
      if (args.theme !== undefined) updateData.theme = args.theme || null;

      if (Object.keys(updateData).length === 0) return "Error: No fields to update.";

      await db.update(cycles).set(updateData).where(and(eq(cycles.id, cycleId), eq(cycles.userId, userId)));
      await createAutoLog(userId, `✏️ Cycle updated: ${args.name || existing.name}`);
      return `Cycle "${args.name || existing.name}" updated.`;
    }

    case "delete_task": {
      const taskId = parseInt(args.taskId);
      if (!taskId) return "Error: taskId is required.";

      const [task] = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
      if (!task) return "Error: Task not found.";

      if (task.goalId) {
        // Goal-linked: dismiss instead of delete to prevent auto-recreation
        await db.update(tasks).set({ dismissed: true, completed: false, value: null, pointsEarned: 0 }).where(eq(tasks.id, taskId));
      } else {
        await db.delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
      }

      // Recalculate linked goal if task had progress
      if (task.goalId && (task.completed || (task.value ?? 0) > 0)) {
        const [linkedGoal] = await db.select().from(goals).where(and(eq(goals.id, task.goalId), eq(goals.userId, userId)));
        if (linkedGoal && linkedGoal.goalType !== 'outcome') {
          const remaining = await db.select({ value: tasks.value }).from(tasks)
            .where(and(eq(tasks.goalId, task.goalId), eq(tasks.dismissed, false), or(eq(tasks.completed, true), gt(tasks.value, 0))));
          const newTotal = remaining.reduce((sum, t) => sum + (t.value ?? 0), 0);
          await db.update(goals).set({ currentValue: newTotal }).where(eq(goals.id, linkedGoal.id));
        }
      }

      // Recalculate daily score
      if (task.date) await saveDailyScore(userId, task.date);

      await createAutoLog(userId, `🗑️ Task deleted: ${task.name}`);
      return `Task "${task.name}" ${task.goalId ? "dismissed" : "deleted"}.`;
    }

    case "get_cycles": {
      const result = await db.select().from(cycles).where(eq(cycles.userId, userId)).orderBy(desc(cycles.startDate));
      const lines = result.map(c =>
        `(id:${c.id}) ${c.name} | ${c.startDate} to ${c.endDate}${c.theme ? ` | theme: ${c.theme}` : ""}${c.vision ? ` | vision: ${c.vision}` : ""}`
      );
      return lines.join("\n") || "No cycles found.";
    }

    case "get_feedback": {
      const conditions = [eq(contactMessages.userId, userId)];
      if (args.status) conditions.push(eq(contactMessages.status, args.status));
      const result = await db.select().from(contactMessages).where(and(...conditions)).orderBy(desc(contactMessages.createdAt));
      const lines = result.map(m =>
        `(id:${m.id}) [${m.status}] ${m.topic} — ${m.message}${m.read ? "" : " (unread)"}`
      );
      return lines.join("\n") || "No feedback messages found.";
    }

    case "create_cycle": {
      const cycleName = args.name;
      if (!cycleName || !args.startDate || !args.endDate) return "Error: name, startDate, and endDate are required.";

      const [cycle] = await db.insert(cycles).values({
        userId,
        name: cycleName,
        startDate: args.startDate,
        endDate: args.endDate,
        vision: args.vision || null,
        theme: args.theme || null,
      }).returning();

      await createAutoLog(userId, `📅 Cycle created: ${cycleName}`);
      return `Cycle "${cycleName}" created (${args.startDate} to ${args.endDate}). Cycle ID: ${cycle.id}. Use this ID as periodId when creating goals.`;
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

function jsonRpcResponse(id: number | string, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result }, {
    headers: { "Content-Type": "application/json" },
  });
}

function jsonRpcError(id: number | string | null, code: number, message: string) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } }, {
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: NextRequest) {
  try {
    const userId = await authenticate(request);
    const message = await request.json();

    // Handle initialization (no auth needed for handshake)
    if (message.method === "initialize") {
      const sessionId = crypto.randomUUID();
      // Store session -> userId mapping if authenticated
      if (userId) {
        sessions.set(sessionId, userId);
      }
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: message.id,
        result: {
          protocolVersion: "2025-06-18",
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        },
      }), {
        headers: {
          "Content-Type": "application/json",
          "Mcp-Session-Id": sessionId,
        },
      });
    }

    // Handle initialized notification
    if (message.method === "notifications/initialized") {
      return new Response(null, { status: 202 });
    }

    // Resolve userId: direct auth or from an existing session
    const sessionId = request.headers.get("mcp-session-id");
    const resolvedUserId = userId || (sessionId ? sessions.get(sessionId) : null);

    // All other methods need auth
    if (!resolvedUserId) {
      return jsonRpcError(message.id, -32000, "Invalid API key. Pass via Authorization: Bearer <key> header or ?key= query param.");
    }

    // Tool discovery
    if (message.method === "tools/list") {
      return jsonRpcResponse(message.id, { tools: TOOLS });
    }

    // Tool execution
    if (message.method === "tools/call") {
      const { name, arguments: args } = message.params;
      const result = await executeTool(resolvedUserId, name, args || {});
      return jsonRpcResponse(message.id, {
        content: [{ type: "text", text: result }],
      });
    }

    // Ping
    if (message.method === "ping") {
      return jsonRpcResponse(message.id, {});
    }

    return jsonRpcError(message.id, -32601, `Method not found: ${message.method}`);
  } catch (error) {
    console.error("MCP error:", error);
    return jsonRpcError(null, -32603, "Internal error");
  }
}

export async function DELETE(request: NextRequest) {
  // Session termination
  const sessionId = request.headers.get("mcp-session-id");
  if (sessionId) sessions.delete(sessionId);
  return new Response(null, { status: 202 });
}

export async function GET() {
  return new Response(null, { status: 405 });
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, x-api-key",
    },
  });
}
