export type GoalsStackParamList = {
  GoalsList: undefined;
  GoalDetail: { goalId: number };
  GoalForm: { goalId?: number };
};

export type CyclesStackParamList = {
  CyclesList: undefined;
  CycleDetail: { cycleId: number };
  CycleForm: { cycleId?: number };
};

export type PillarsStackParamList = {
  PillarsList: undefined;
  PillarDetail: { pillarId: number };
  PillarForm: { pillarId?: number };
};

export type TasksStackParamList = {
  TasksList: undefined;
  TaskForm: { date: string; taskId?: number };
};

export type MoreStackParamList = {
  MoreMenu: undefined;
  Dashboard: undefined;
};

export type RootTabParamList = {
  Tasks: undefined;
  Log: undefined;
  More: undefined;
};
