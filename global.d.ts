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
