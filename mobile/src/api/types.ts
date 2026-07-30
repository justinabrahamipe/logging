export type CompletionType = "checkbox" | "count" | "numeric" | "duration";
export type FlexibilityRule = "must_today" | "at_least" | "limit_avoid";

export type Pillar = {
  id: number;
  userId: string;
  name: string;
  emoji: string | null;
  color: string | null;
  defaultBasePoints: number;
  description: string | null;
};

export type TaskCompletion = {
  id: number;
  taskId: number;
  completed: boolean;
  value: number;
  pointsEarned: number;
  isHighlighted: boolean;
  skipped: boolean;
  timerStartedAt: number | null;
};

export type Task = {
  id: number;
  userId: string;
  pillarId: number | null;
  goalId: number | null;
  scheduleId: number | null;
  name: string;
  completionType: CompletionType;
  target: number | null;
  unit: string | null;
  basePoints: number;
  flexibilityRule: FlexibilityRule;
  limitValue: number | null;
  date: string;
  completed: boolean;
  value: number;
  pointsEarned: number;
  isHighlighted: boolean;
  skipped: boolean;
  timerStartedAt: number | null;
  dismissed: boolean;
  frequency: string;
  description?: string | null;
  completion: TaskCompletion | null;
};

export type TaskGroup = {
  pillar: Pillar | null;
  tasks: Task[];
};

export type TodayResponse = {
  groups: TaskGroup[];
  noDateTasks: Task[];
  overdueTasks: Task[];
};

export type DayResponse = TaskGroup[];

export type LocationLog = {
  id: number;
  userId: string;
  latitude: number;
  longitude: number;
  date: string;
  time: string | null;
  notes: string | null;
  createdAt: string;
};

export type GoalType = "outcome" | "target" | "habitual" | "project";
export type GoalStatus = "active" | "completed" | "abandoned";

export type Goal = {
  id: number;
  userId: string;
  name: string;
  pillarId: number | null;
  pillarName?: string | null;
  pillarColor?: string | null;
  pillarEmoji?: string | null;
  startValue: number;
  targetValue: number;
  currentValue: number;
  unit: string | null;
  startDate: string | null;
  targetDate: string | null;
  periodId: number | null;
  goalType: GoalType;
  completionType: CompletionType;
  dailyTarget: number | null;
  scheduleDays: number[] | null;
  autoCreateTasks: boolean;
  flexibilityRule: FlexibilityRule;
  limitValue: number | null;
  basePoints: number;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
};

export type GoalTask = {
  id: number;
  name: string;
  goalId: number;
  completionType: CompletionType;
  basePoints: number;
  target: number | null;
  unit: string | null;
  date: string;
  completed: boolean;
  value: number;
};

export type GoalLogEntry = {
  id: number;
  outcomeId: number;
  value: number;
  loggedAt: string;
};

export type Cycle = {
  id: number;
  userId: string;
  name: string;
  startDate: string;
  endDate: string;
  vision: string | null;
  theme: string | null;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
};

export type CycleGoal = Goal & { pillarName?: string | null; pillarColor?: string | null; pillarEmoji?: string | null };

export type LinkedTask = {
  id: number;
  name: string;
  pillarId: number | null;
  goalId: number | null;
  periodId: number | null;
  frequency: string;
};

export type CycleDetail = Cycle & {
  goals: CycleGoal[];
  linkedTasks: LinkedTask[];
};

export type DailyScore = {
  date: string;
  actionScore: number;
  momentumScore: number | null;
  scoreTier: string;
  pillarScores: { id: number; name: string; emoji: string | null; color: string | null; defaultBasePoints: number; score: number }[];
  totalTasks: number;
  completedTasks: number;
};

export type ScoreHistoryEntry = {
  date: string;
  actionScore: number;
  momentumScore: number | null;
  trajectoryScore: number | null;
};

export type ScoreHistoryResponse = {
  scores: ScoreHistoryEntry[];
  pillars: { id: number; name: string; emoji: string | null; color: string | null; defaultBasePoints: number }[];
};

export type Momentum = {
  overall: number | null;
  pillars: { id: number; name: string; emoji: string | null; color: string | null; defaultBasePoints: number; momentum: number | null }[];
  goals: { goalId: number; goalType: string; pillarId: number | null; momentum: number; label: string; name: string; currentValue: number; targetValue: number; unit: string }[];
  trajectory: {
    overall: number | null;
    goals: { goalId: number; pillarId: number | null; trajectory: number; label: string; name: string; currentValue: number; targetValue: number; unit: string }[];
  };
};
