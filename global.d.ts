// Global type definitions
declare global {
  type ActivityType = {
    id: number;
    icon: string;
    title: string;
    category: string;
    createdOn?: Date;
    color?: string;
  };

  type LogType = {
    id: number;
    comment?: string;
    activityTitle: string;
    activityCategory: string;
    activityIcon: string;
    activityColor?: string;
    start_time?: Date;
    end_time?: Date;
    created_on?: Date;
    time_spent?: number;
    tags?: string;
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
  };
}

export {};
