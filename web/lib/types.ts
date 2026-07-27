// ============================================================
// Centralized type definitions
// ============================================================

// ------ Entity types ------

export interface Pillar {
  id: number;
  name: string;
  emoji: string;
  color: string;
  defaultBasePoints?: number;
  description?: string | null;
}

export interface Task {
  id: number;
  scheduleId?: number | null;
  pillarId: number;
  name: string;
  completionType: string;
  target: number | null;
  unit: string | null;
  frequency: string;
  customDays: string | null;
  repeatInterval: number | null;
  basePoints: number;
  goalId: number | null;
  periodId: number | null;
  startDate: string | null;
  endDate?: string | null;
  flexibilityRule?: string;
  limitValue?: number | null;
  description?: string | null;
  completion?: TaskCompletion | null;
}

export interface TaskCompletion {
  id: number;
  taskId: number;
  completed: boolean;
  value: number | null;
  pointsEarned: number;
  isHighlighted: boolean;
  skipped: boolean;
  timerStartedAt: number | null;
}

export interface TaskGroup {
  pillar: Pillar;
  tasks: Task[];
}

export interface Outcome {
  id: number;
  pillarId: number | null;
  periodId: number | null;
  name: string;
  startValue: number;
  targetValue: number;
  currentValue: number;
  unit: string;
  startDate: string | null;
  targetDate: string | null;
  goalType: string;
  completionType: string;
  dailyTarget: number | null;
  scheduleDays: string | null;
  autoCreateTasks: boolean;
  flexibilityRule?: string;
  limitValue?: number | null;
  basePoints?: number;

  status?: string;
  pillarName: string | null;
  pillarColor: string | null;
  pillarEmoji: string | null;
}

export interface Cycle {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  vision: string | null;
  theme: string | null;
  isActive: boolean;
  createdAt?: string;
}

export interface CycleOption {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
}

export interface Goal {
  id: number;
  name: string;
  goalType: string;
  pillarEmoji?: string;
  pillarName?: string;
  periodId?: number;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  startValue?: number;
  pillarId?: number | null;
  startDate?: string | null;
  targetDate?: string | null;
}

export interface LinkedTask {
  id: number;
  name: string;
  goalId?: number | null;
  frequency: string;
  completionType: string;
  basePoints: number;
  target?: number | null;
  unit?: string | null;
  completed?: boolean;
  value?: number | null;
  startDate?: string | null;
}

export interface LogEntry {
  id: number;
  value: number;
  loggedAt: string;
}

export interface ActivityEntry {
  id: number;
  timestamp: string;
  taskId: number | null;
  pillarId: number | null;
  action: string;
  previousValue: number | null;
  newValue: number | null;
  delta: number | null;
  pointsBefore: number | null;
  pointsAfter: number | null;
  pointsDelta: number | null;
  source: string;
  taskName: string | null;
  taskCompletionType: string | null;
  pillarName: string | null;
  pillarEmoji: string | null;
  pillarColor: string | null;
  outcomeLogValue: number | null;
}

// ------ Dashboard / scoring types ------

export interface PillarScore {
  id: number;
  name: string;
  emoji: string;
  color: string;
  defaultBasePoints: number;
  score: number;
}

export interface DailyScoreData {
  date: string;
  actionScore: number;
  momentumScore: number | null;
  scoreTier: string;
  pillarScores: PillarScore[];
  totalTasks: number;
  completedTasks: number;
}

export interface PillarMeta {
  id: number;
  name: string;
  emoji: string;
  color: string;
  defaultBasePoints: number;
}

export interface HistoryScore {
  date: string;
  actionScore: number;
  momentumScore: number | null;
  trajectoryScore: number | null;
  pillarScores: Record<string, number>;
  pillarMomentum: Record<string, number>;
}

export interface HistoryData {
  scores: HistoryScore[];
  pillars: PillarMeta[];
}

export interface OutcomeData {
  id: number;
  name: string;
  startValue: number;
  targetValue: number;
  currentValue: number;
  unit: string;
  pillarColor: string | null;
  pillarEmoji: string | null;
  goalType: string;
  scheduleDays: string | null;
  startDate: string | null;
  targetDate: string | null;
  dailyTarget: number | null;
  completionType: string;
  periodId: number | null;
}

// ------ Momentum types ------

export interface MomentumGoal {
  goalId: number;
  goalType: string;
  pillarId: number | null;
  momentum: number;
  bufferDays: number;
  label: string;
  name: string;
  currentValue: number;
  targetValue: number;
  unit: string;
}

export interface MomentumPillar {
  id: number;
  name: string;
  emoji: string;
  color: string;
  momentum: number | null;
}

export interface TrajectoryGoal {
  goalId: number;
  pillarId: number | null;
  trajectory: number;
  label: string;
  name: string;
  currentValue: number;
  targetValue: number;
  unit: string;
}

export interface MomentumData {
  overall: number;
  pillars: MomentumPillar[];
  goals: MomentumGoal[];
  trajectory: {
    overall: number;
    goals: TrajectoryGoal[];
  };
}

export interface GoalForMomentum {
  id: number;
  goalType: string;
  pillarId: number | null;
  targetValue: number;
  startValue: number;
  currentValue: number;
  startDate: string | null;
  targetDate: string | null;
  scheduleDays: string | null;
  flexibilityRule?: string;
  limitValue?: number | null;
  dailyTarget?: number | null;
  completionType?: string;
}

export interface GoalLogEntry {
  outcomeId: number;
  value: number;
  loggedAt: string;
}

export interface GoalMomentum {
  goalId: number;
  goalType: string;
  pillarId: number | null;
  momentum: number;
  bufferDays: number;
  label: string;
}

export interface MomentumSummary {
  overall: number;
  pillarMomentum: Record<number, number>;
  goals: GoalMomentum[];
}

// ------ Scoring types ------

export interface TaskForScoring {
  id: number;
  pillarId: number | null;
  completionType: string;
  target: number | null;
  basePoints: number;
  flexibilityRule?: string;
  limitValue?: number | null;

}

export interface CompletionForScoring {
  taskId: number;
  completed: boolean;
  value: number | null;
  isHighlighted?: boolean;
  skipped?: boolean;
}

// ------ Effort calculation types ------

export interface EffortMetrics {
  dailyTarget: number;
  currentRate: number;
  requiredRate: number;
  projectedDate: string | null;
  status: 'ahead' | 'on_track' | 'behind';
  idealProgress: number;
}

// ------ Form state types ------

export interface TaskFormState {
  pillarId: number;
  goalId: number;
  name: string;
  description: string;
  completionType: string;
  target: string;
  unit: string;
  flexibilityRule: string;
  frequencyPreset: string;
  frequency: string;
  customDays: number[];
  repeatInterval: string;
  repeatUnit: "days" | "weeks" | "months";
  monthDay: number;
  basePoints: string;
  pointsMode: 'pillar' | 'manual';
  startDate: string;
  endDate: string;
}

export interface GoalFormState {
  name: string;
  startValue: string;
  targetValue: string;
  unit: string;
  pillarId: string;
  startDate: string;
  targetDate: string;
  periodId: string;
  goalType: "habitual" | "target" | "outcome" | "project";
  completionType: "checkbox" | "count" | "numeric" | "duration";
  dailyTarget: string;

  basePoints: string;
  pointsMode: 'pillar' | 'manual';
  autoCreateTasks: boolean;
  flexibilityRule: string;
  frequencyPreset: string;
  customDays: number[];
  repeatInterval: string;
  repeatUnit: "days" | "weeks" | "months";
  monthDay: number;
}

// ------ Seed data types ------

export interface PillarSeed {
  name: string;
  emoji: string;
  color: string;
  defaultBasePoints: number;
  description: string;
  tasks: TaskSeed[];
}

export interface TaskSeed {
  name: string;
  completionType: string;
  target?: number;
  unit?: string;
  frequency: string;
  customDays?: string;
  flexibilityRule?: string;
  basePoints: number;
}

// ------ Pillar page types ------

export interface CycleInfo {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface CyclePerformance {
  cycle: { id: number; name: string; startDate: string; endDate: string; totalDays: number };
  effort: { date: string; score: number; pillarScores: Record<string, number> }[];
  outcomes: { id: number; name: string; startValue: number; targetValue: number; logs: { date: string; progress: number }[] }[];
  pillars: { id: number; name: string; emoji: string; color: string }[];
}

// ------ Cycle page types ------

export interface CycleGoal {
  id: number;
  periodId: number;
  name: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  startValue: number;
  goalType: string;
  pillarId: number | null;
  startDate?: string | null;
  targetDate?: string | null;
  completionType?: string;
  dailyTarget?: number | null;
  scheduleDays?: string | null;
  status?: string;
  flexibilityRule?: string;
  limitValue?: number | null;

  pillarName?: string | null;
  pillarColor?: string | null;
  pillarEmoji?: string | null;
}

export interface CycleDetail extends Cycle {
  goals: CycleGoal[];
  linkedTasks: LinkedTask[];
}
