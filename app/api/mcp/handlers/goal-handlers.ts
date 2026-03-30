import { db, goals, tasks, taskSchedules, pillars, cycles } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getTodayString } from "@/lib/format";
import { createAutoLog } from "@/lib/auto-log";
import { generateGoalTasks } from "@/lib/ensure-upcoming-tasks";
import { deleteFutureUncompletedTasks, deleteTasksBeyondDate, deleteTasksOnRemovedDays, regenerateGoalTasksIfNeeded } from "@/lib/goal-mutations";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleCreateGoal(args: any, userId: string): Promise<string> {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleEditGoal(args: any, userId: string): Promise<string> {
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
    await deleteFutureUncompletedTasks(goalId, userId);
  }

  // When targetDate is preponed, delete uncompleted tasks beyond the new end date
  if (args.targetDate !== undefined && args.targetDate) {
    await deleteTasksBeyondDate(goalId, userId, args.targetDate);
  }

  // When scheduleDays changed, delete uncompleted future tasks on removed days
  if (args.scheduleDays !== undefined) {
    const newDays: number[] = args.scheduleDays || [];
    const oldDays: number[] = existing.scheduleDays ? JSON.parse(existing.scheduleDays) : [];
    await deleteTasksOnRemovedDays(goalId, userId, oldDays, newDays);
  }

  // When autoCreateTasks is turned off, delete future uncompleted tasks
  if (args.autoCreateTasks === false && existing.autoCreateTasks) {
    await deleteFutureUncompletedTasks(goalId, userId);
  }

  // Generate new tasks for extended range, new days, or toggled-on autoCreateTasks
  await regenerateGoalTasksIfNeeded(goalId, userId, existing, args, null);

  // Propagate name/pillar/completionType changes to linked tasks
  const propagate: Record<string, unknown> = {};
  if (args.name !== undefined) propagate.name = args.name;
  if (args.pillarId !== undefined) propagate.pillarId = args.pillarId || null;
  if (args.completionType !== undefined) propagate.completionType = args.completionType;
  if (args.unit !== undefined) propagate.unit = args.unit || null;

  if (Object.keys(propagate).length > 0) {
    const todayStr = getTodayString();
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
