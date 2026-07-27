import { db, tasks, taskSchedules } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getTodayString } from "@/lib/format";
import { createAutoLog } from "@/lib/auto-log";
import { saveDailyScore, recalculateDateScores } from "@/lib/save-daily-score";
import { ensureUpcomingTasks, invalidateTaskCache } from "@/lib/ensure-upcoming-tasks";
import { completeTask } from "@/lib/complete-task";
import { getOwnedTask, getOwnedPillar, getOwnedGoal } from "@/lib/db-utils";
import { mapTaskUpdateFields, mapScheduleUpdateFields } from "@/lib/task-utils";
import { isTaskTooOldToEdit, dismissOrDeleteTask } from "@/lib/task-mutations";
import { recalculateGoalCurrentValue } from "@/lib/goal-mutations";

const DAY_MAP: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

function parseCustomDaysInput(input: string | null | undefined): string | null {
  if (!input) return null;
  // Already a JSON array
  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) return JSON.stringify(parsed);
  } catch { /* not JSON, try comma-separated */ }
  // Comma-separated day names: "mon,tue,wed" -> [1,2,3]
  const days = input.split(',').map(s => DAY_MAP[s.trim().toLowerCase()]).filter(n => n !== undefined);
  return days.length > 0 ? JSON.stringify(days) : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleCompleteTask(args: any, userId: string): Promise<string> {
  const taskId = parseInt(args.taskId, 10);
  if (isNaN(taskId) || taskId <= 0) return "Error: taskId is required.";

  const task = await getOwnedTask(taskId, userId);
  if (!task) return "Error: Task not found.";

  // Only allow changes for today, yesterday, and future
  if (isTaskTooOldToEdit(task.date)) {
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
  const basePoints = args.basePoints ? (parseInt(args.basePoints, 10) || 10) : 10;
  const target = args.target ? parseFloat(args.target) : null;
  const pillarId = args.pillarId ? (parseInt(args.pillarId, 10) || null) : null;

  if (pillarId) {
    const p = await getOwnedPillar(pillarId, userId);
    if (!p) return "Error: Pillar not found.";
  }

  // If linked to a goal, inherit dates and pillar from the goal
  const goalId = args.goalId ? (parseInt(args.goalId, 10) || null) : null;
  let goalStartDate: string | null = null;
  let goalEndDate: string | null = null;
  let goalPillarId = pillarId;
  let goalPeriodId = args.periodId ? (parseInt(args.periodId, 10) || null) : null;
  if (goalId) {
    const goal = await getOwnedGoal(goalId, userId);
    if (!goal) return "Error: Goal not found.";
    goalStartDate = goal.startDate;
    goalEndDate = goal.targetDate;
    if (!goalPillarId) goalPillarId = goal.pillarId;
    if (!goalPeriodId) goalPeriodId = goal.periodId;
  }

  if (isRecurring) {
    const [schedule] = await db.insert(taskSchedules).values({
      pillarId: goalPillarId,
      userId,
      name: taskName,
      description: args.description || null,
      completionType,
      target,
      unit: args.unit || null,
      flexibilityRule: args.flexibilityRule || 'must_today',
      limitValue: args.limitValue ?? null,
      frequency,
      customDays: parseCustomDaysInput(args.customDays),
      repeatInterval: args.repeatInterval ? (parseInt(args.repeatInterval, 10) || null) : null,
      basePoints,
      goalId,
      periodId: goalPeriodId,
      startDate: args.startDate || goalStartDate,
      endDate: args.endDate || goalEndDate,
    }).returning();

    invalidateTaskCache(userId);
    await ensureUpcomingTasks(userId);
    await createAutoLog(userId, `➕ Task created: ${taskName}`);
    return `Recurring task "${taskName}" created (${frequency}). Schedule ID: ${schedule.id}.`;
  } else {
    const taskDate = args.date !== undefined ? args.date : (goalStartDate || '');
    const [task] = await db.insert(tasks).values({
      pillarId: goalPillarId,
      userId,
      name: taskName,
      description: args.description || null,
      completionType,
      target,
      unit: args.unit || null,
      flexibilityRule: args.flexibilityRule || 'must_today',
      limitValue: args.limitValue ?? null,
      basePoints,
      goalId,
      periodId: goalPeriodId,
      date: taskDate,
    }).returning();

    await createAutoLog(userId, `➕ Task created: ${taskName}`);
    return `Task "${taskName}" created${taskDate ? ` for ${taskDate}` : ' (no date)'}. Task ID: ${task.id}.`;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleEditTask(args: any, userId: string): Promise<string> {
  const taskId = parseInt(args.taskId, 10);
  if (isNaN(taskId) || taskId <= 0) return "Error: taskId is required.";

  const task = await getOwnedTask(taskId, userId);
  if (!task) return "Error: Task not found.";

  // Only allow edits for today, yesterday, and future
  if (isTaskTooOldToEdit(task.date)) {
    return "Error: Cannot modify tasks older than yesterday.";
  }

  const updateData = mapTaskUpdateFields(args);
  if (Object.keys(updateData).length === 0) return "Error: No fields to update.";

  await db.update(tasks).set(updateData).where(eq(tasks.id, taskId));

  // Propagate to schedule if linked. Schedules use startDate; map task.date → startDate.
  if (task.scheduleId) {
    const scheduleSrc = { ...args, startDate: args.date !== undefined ? args.date : args.startDate };
    const scheduleUpdate = mapScheduleUpdateFields(scheduleSrc);
    if (Object.keys(scheduleUpdate).length > 0) {
      await db.update(taskSchedules).set(scheduleUpdate).where(eq(taskSchedules.id, task.scheduleId));
    }
  }

  // Recalculate scores if date changed
  if (args.date !== undefined) {
    await recalculateDateScores(userId, task.date, args.date);
  }

  await createAutoLog(userId, `✏️ Task updated: ${args.name || task.name}`);
  return `Task "${args.name || task.name}" updated.`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleDeleteTask(args: any, userId: string): Promise<string> {
  const taskId = parseInt(args.taskId, 10);
  if (isNaN(taskId) || taskId <= 0) return "Error: taskId is required.";

  const task = await getOwnedTask(taskId, userId);
  if (!task) return "Error: Task not found.";

  await dismissOrDeleteTask(taskId, userId, task.goalId, task.scheduleId);

  // Recalculate linked goal if task had progress
  if (task.goalId && (task.completed || (task.value ?? 0) > 0)) {
    await recalculateGoalCurrentValue(task.goalId, userId);
  }

  // Recalculate daily score
  if (task.date) await saveDailyScore(userId, task.date);

  await createAutoLog(userId, `🗑️ Task deleted: ${task.name}`);
  return `Task "${task.name}" ${(task.goalId || task.scheduleId) ? "dismissed" : "deleted"}.`;
}
