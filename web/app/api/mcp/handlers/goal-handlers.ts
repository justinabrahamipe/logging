import { db, goals, tasks, taskSchedules, cycles } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getTodayString } from "@/lib/format";
import { createAutoLog, logGoalStatusChange } from "@/lib/auto-log";
import { generateGoalTasks } from "@/lib/ensure-upcoming-tasks";
import { deleteFutureUncompletedTasks, regenerateGoalTasksIfNeeded } from "@/lib/goal-mutations";
import { getOwnedGoal, getOwnedPillar } from "@/lib/db-utils";
import { mapGoalUpdateFields, buildGoalPropagationPair } from "@/lib/goal-utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleCreateGoal(args: any, userId: string): Promise<string> {
  const goalName = args.name;
  if (!goalName) return "Error: name is required.";

  const goalType = args.goalType || 'outcome';
  const isActivityGoal = goalType === 'habitual' || goalType === 'target';
  const isProject = goalType === 'project';

  // outcome/target goals need an explicit target. project goals start at 0 and grow with subtasks.
  if (!isActivityGoal && !isProject && args.targetValue == null) {
    return "Error: targetValue is required for outcome/target goals.";
  }

  const pillarId = args.pillarId ? (parseInt(args.pillarId, 10) || null) : null;
  if (pillarId) {
    const p = await getOwnedPillar(pillarId, userId);
    if (!p) return "Error: Pillar not found.";
  }

  let startDate = args.startDate || null;
  let targetDate = args.targetDate || null;

  // For activity goals with a period, derive dates from the cycle
  if (isActivityGoal && args.periodId) {
    const periodIdNum = parseInt(args.periodId, 10);
    const [cycle] = periodIdNum ? await db.select().from(cycles).where(eq(cycles.id, periodIdNum)) : [];
    if (cycle) {
      if (!startDate) startDate = cycle.startDate;
      if (!targetDate) targetDate = cycle.endDate;
    }
  }

  const startValue = args.startValue ?? 0;
  const scheduleDays = Array.isArray(args.scheduleDays) ? args.scheduleDays : null;

  const [goal] = await db.insert(goals).values({
    userId,
    name: goalName,
    startValue,
    targetValue: args.targetValue ?? 0,
    currentValue: startValue,
    unit: args.unit || (isProject ? 'steps' : 'days'),
    pillarId,
    startDate,
    targetDate,
    periodId: args.periodId ? (parseInt(args.periodId, 10) || null) : null,
    goalType,
    completionType: args.completionType || 'checkbox',
    dailyTarget: args.dailyTarget ?? null,
    scheduleDays: scheduleDays ? JSON.stringify(scheduleDays) : null,
    autoCreateTasks: !isProject && (args.autoCreateTasks === true || args.autoCreateTasks === 'true' || isActivityGoal),
    flexibilityRule: args.flexibilityRule || 'must_today',
    limitValue: args.limitValue ?? null,
    basePoints: args.basePoints ?? 10,
  }).returning();

  // Generate all tasks upfront for the full goal date range
  if (goal.autoCreateTasks) {
    await generateGoalTasks(userId, goal.id);
  }

  await createAutoLog(userId, `📌 Goal created: ${goalName}`);
  return `Goal "${goalName}" created (${goalType}). Goal ID: ${goal.id}.`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleEditGoal(args: any, userId: string): Promise<string> {
  const goalId = parseInt(args.goalId, 10);
  if (isNaN(goalId) || goalId <= 0) return "Error: goalId is required.";

  const existing = await getOwnedGoal(goalId, userId);
  if (!existing) return "Error: Goal not found.";

  const isProject = existing.goalType === 'project';

  const updateData = mapGoalUpdateFields(args);
  if (Object.keys(updateData).length === 0) return "Error: No fields to update.";

  // Project goals never auto-create daily tasks — their subtasks are added by the user.
  if (isProject) updateData.autoCreateTasks = false;

  // Auto-complete target/outcome goals when marked completed
  if (args.status === 'completed' && (existing.goalType === 'target' || existing.goalType === 'outcome')) {
    updateData.currentValue = existing.targetValue;
  }

  await db.update(goals).set(updateData).where(and(eq(goals.id, goalId), eq(goals.userId, userId)));

  // When completed/abandoned, delete future uncompleted tasks
  if (args.status === 'completed' || args.status === 'abandoned') {
    await deleteFutureUncompletedTasks(goalId, userId);
  }

  // When autoCreateTasks is turned off, delete future uncompleted tasks
  if (args.autoCreateTasks === false && existing.autoCreateTasks) {
    await deleteFutureUncompletedTasks(goalId, userId);
  }

  // Prune stale tasks and (re)generate for range/schedule changes
  await regenerateGoalTasksIfNeeded(goalId, userId, existing, args, null);

  // Propagate changes to linked uncompleted tasks and their schedules
  const { tasks: propagateToTasks, schedules: propagateToSchedules } = buildGoalPropagationPair(args, existing.goalType);

  if (Object.keys(propagateToTasks).length > 0) {
    const todayStr = getTodayString();
    const linkedTasks = await db.select().from(tasks)
      .where(and(eq(tasks.goalId, goalId), eq(tasks.userId, userId), eq(tasks.completed, false)));
    for (const t of linkedTasks) {
      if (t.date >= todayStr) {
        await db.update(tasks).set(propagateToTasks).where(eq(tasks.id, t.id));
      }
    }
  }

  if (Object.keys(propagateToSchedules).length > 0) {
    await db.update(taskSchedules).set(propagateToSchedules)
      .where(and(eq(taskSchedules.goalId, goalId), eq(taskSchedules.userId, userId)));
  }

  await logGoalStatusChange(userId, existing, args);

  return `Goal "${args.name || existing.name}" updated.`;
}
