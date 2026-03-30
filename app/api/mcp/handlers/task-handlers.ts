import { db, tasks, taskSchedules, pillars, goals } from "@/lib/db";
import { eq, and, gt, or } from "drizzle-orm";
import { getTodayString, getYesterdayString } from "@/lib/format";
import { createAutoLog } from "@/lib/auto-log";
import { saveDailyScore } from "@/lib/save-daily-score";
import { ensureUpcomingTasks, invalidateTaskCache } from "@/lib/ensure-upcoming-tasks";
import { completeTask } from "@/lib/complete-task";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleCompleteTask(args: any, userId: string): Promise<string> {
  const taskId = parseInt(args.taskId);
  if (!taskId) return "Error: taskId is required.";

  const [task] = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
  if (!task) return "Error: Task not found.";

  // Only allow changes for today, yesterday, and future
  const yesterdayStr = getYesterdayString();
  if (task.date < yesterdayStr) {
    return "Error: Cannot modify tasks older than yesterday.";
  }

  const completionValue = args.value != null ? parseFloat(args.value) : (task.completionType === 'checkbox' ? 1 : 0);
  const isCompleted = args.completed != null ? args.completed === "true" || args.completed === true : undefined;

  const { result } = await completeTask({
    userId,
    taskId,
    date: task.date || getTodayString(),
    completed: isCompleted,
    value: completionValue,
  });

  const status = result.completed ? "completed" : "updated";
  const valStr = task.completionType !== 'checkbox' ? ` (value: ${result.value})` : '';
  return `Task "${task.name}" ${status}${valStr}. Points: ${result.pointsEarned}.`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleCreateTask(args: any, userId: string): Promise<string> {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleEditTask(args: any, userId: string): Promise<string> {
  const taskId = parseInt(args.taskId);
  if (!taskId) return "Error: taskId is required.";

  const [task] = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
  if (!task) return "Error: Task not found.";

  // Only allow edits for today, yesterday, and future
  const yesterdayStr = getYesterdayString();
  if (task.date < yesterdayStr) {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleDeleteTask(args: any, userId: string): Promise<string> {
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
