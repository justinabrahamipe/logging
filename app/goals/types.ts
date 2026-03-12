export interface Outcome {
  id: number;
  pillarId: number | null;
  periodId: number | null;
  name: string;
  startValue: number;
  targetValue: number;
  currentValue: number;
  unit: string;
  direction: string;
  logFrequency: string;
  startDate: string | null;
  targetDate: string | null;
  goalType: string;
  completionType: string;
  dailyTarget: number | null;
  scheduleDays: string | null;
  autoCreateTasks: boolean;
  pillarName: string | null;
  pillarColor: string | null;
  pillarEmoji: string | null;
}

export interface CycleOption {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
}

export interface Pillar {
  id: number;
  name: string;
  emoji: string;
  color: string;
}

export interface LinkedTask {
  id: number;
  name: string;
  goalId: number | null;
  frequency: string;
  completionType: string;
  basePoints: number;
  target: number | null;
  unit: string | null;
  completed: boolean;
  value: number | null;
  startDate: string | null;
}

export interface LogEntry {
  id: number;
  value: number;
  loggedAt: string;
  note: string | null;
}

export interface GoalFormState {
  name: string;
  startValue: string;
  targetValue: string;
  unit: string;
  pillarId: string;
  logFrequency: string;
  startDate: string;
  targetDate: string;
  periodId: string;
  goalType: "habitual" | "target" | "outcome";
  completionType: "checkbox" | "count" | "numeric";
  dailyTarget: string;
  autoCreateTasks: boolean;
  frequencyPreset: string;
  customDays: number[];
  repeatInterval: string;
  repeatUnit: "days" | "weeks" | "months";
  monthDay: number;
}
