// Global type definitions
declare global {
  type ActivityType = {
    id?: number;
    icon: string;
    title: string;
    category: string;
    created_on?: Date | string | null;
    color?: string | null;
  };

  type LogType = {
    id: number;
    comment?: string | null;
    activityTitle: string;
    activityCategory: string;
    activityIcon: string;
    activityColor?: string | null;
    start_time?: Date | string | null;
    end_time?: Date | string | null;
    created_on?: Date | string | null;
    time_spent?: number | null;
    tags?: string | null;
    todoId?: number | null;
    goalId?: number | null;
    goalCount?: number | null;
    logContacts?: {
      id: number;
      contact: {
        id: number;
        name: string;
        photoUrl?: string;
      };
    }[];
    logPlaces?: {
      id: number;
      place: {
        id: number;
        name: string;
        address: string;
      };
    }[];
    todo?: {
      id: number;
      title: string;
      done: boolean;
    } | null;
    goal?: {
      id: number;
      title: string;
      goalType: string;
    } | null;
  };

  type TodoType = {
    title: string;
    description?: string;
    activityTitle?: string;
    activityCategory?: string;
    deadline?: string;
    work_date?: string;
    importance: number;
    urgency: number;
    done?: boolean;
    id?: number;
    createdOn?: Date | string | null;
    isRecurring?: boolean;
    recurrencePattern?: string | null;
    recurrenceInterval?: number | null;
    recurrenceEndDate?: string | null;
    recurrenceCount?: number | null;
    workDateOffset?: number | null;
    recurrenceGroupId?: string | null;
    todoContacts?: {
      id: number;
      contact: {
        id: number;
        name: string;
        photoUrl?: string;
      };
    }[];
    todoPlaces?: {
      id: number;
      place: {
        id: number;
        name: string;
        address: string;
      };
    }[];
    todoGoals?: {
      id: number;
      goal: {
        id: number;
        title: string;
        color?: string | null;
        icon?: string | null;
      };
    }[];
  };

  type GoalType = {
    id?: number;
    title: string;
    description?: string | null;
    goalType: 'limiting' | 'achievement';
    metricType: 'time' | 'count';
    targetValue: number;
    currentValue?: number;
    periodType: 'week' | 'month' | '3months' | '6months' | 'year' | 'custom';
    startDate: Date | string;
    endDate: Date | string;
    activityTitle?: string | null;
    activityCategory?: string | null;
    color?: string | null;
    icon?: string | null;
    created_on?: Date | string | null;
    isActive?: boolean;
    percentComplete?: number;
    percentElapsed?: number;
    daysRemaining?: number;
    dailyTarget?: number;
    isCompleted?: boolean;
    isOverdue?: boolean;
    isRecurring?: boolean;
    recurrencePattern?: string | null;
    recurrenceConfig?: string | null;
    parentGoalId?: number | null;
    contactIds?: number[];
    placeIds?: number[];
    goalContacts?: {
      id: number;
      contact: {
        id: number;
        name: string;
        photoUrl?: string;
      };
    }[];
    goalPlaces?: {
      id: number;
      place: {
        id: number;
        name: string;
        address: string;
      };
    }[];
  };
}

export {};
