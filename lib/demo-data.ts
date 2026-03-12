// Static demo data for unauthenticated users to preview the app

export const DEMO_PILLARS = [
  { id: 1, name: "Health & Fitness", emoji: "\u{1F4AA}", color: "#EF4444", weight: 25, description: "Physical health, exercise, nutrition", sortOrder: 0, userId: "demo" },
  { id: 2, name: "Career", emoji: "\u{1F4BC}", color: "#3B82F6", weight: 25, description: "Job search, skills, professional development", sortOrder: 1, userId: "demo" },
  { id: 3, name: "Side Hustle", emoji: "\u{1F680}", color: "#8B5CF6", weight: 15, description: "Product development, content creation", sortOrder: 2, userId: "demo" },
  { id: 4, name: "Home", emoji: "\u{1F3E0}", color: "#F59E0B", weight: 10, description: "Household chores and maintenance", sortOrder: 3, userId: "demo" },
  { id: 5, name: "Growth", emoji: "\u{1F4D6}", color: "#10B981", weight: 15, description: "Personal development, reading, learning", sortOrder: 4, userId: "demo" },
  { id: 6, name: "Family & Faith", emoji: "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}", color: "#EC4899", weight: 10, description: "Family time, church, community", sortOrder: 5, userId: "demo" },
];

const today = new Date().toISOString().split("T")[0];

export const DEMO_TASK_GROUPS = [
  {
    pillarId: 1,
    pillarName: "Health & Fitness",
    pillarEmoji: "\u{1F4AA}",
    pillarColor: "#EF4444",
    tasks: [
      { id: 1, name: "Gym session", completionType: "checkbox", target: null, unit: null, frequency: "custom", basePoints: 10, pillarId: 1, completed: false, value: null },
      { id: 2, name: "Hit protein target", completionType: "numeric", target: 208, unit: "g", frequency: "daily", basePoints: 10, pillarId: 1, completed: false, value: null },
      { id: 3, name: "Stay in calories", completionType: "numeric", target: 2040, unit: "cal", frequency: "daily", basePoints: 10, pillarId: 1, completed: false, value: null },
      { id: 4, name: "Water intake", completionType: "count", target: 8, unit: "glasses", frequency: "daily", basePoints: 10, pillarId: 1, completed: false, value: null },
      { id: 5, name: "Take supplements", completionType: "checkbox", target: null, unit: null, frequency: "daily", basePoints: 10, pillarId: 1, completed: true, value: null },
    ],
  },
  {
    pillarId: 2,
    pillarName: "Career",
    pillarEmoji: "\u{1F4BC}",
    pillarColor: "#3B82F6",
    tasks: [
      { id: 6, name: "LeetCode problem", completionType: "count", target: 1, unit: "problems", frequency: "daily", basePoints: 10, pillarId: 2, completed: true, value: 1 },
      { id: 7, name: "DSA concept", completionType: "checkbox", target: null, unit: null, frequency: "daily", basePoints: 10, pillarId: 2, completed: false, value: null },
      { id: 8, name: "Deep-dive topic", completionType: "duration", target: 15, unit: "min", frequency: "daily", basePoints: 10, pillarId: 2, completed: false, value: null },
    ],
  },
  {
    pillarId: 3,
    pillarName: "Side Hustle",
    pillarEmoji: "\u{1F680}",
    pillarColor: "#8B5CF6",
    tasks: [
      { id: 9, name: "Product work", completionType: "duration", target: 60, unit: "min", frequency: "daily", basePoints: 10, pillarId: 3, completed: false, value: null },
    ],
  },
  {
    pillarId: 5,
    pillarName: "Growth",
    pillarEmoji: "\u{1F4D6}",
    pillarColor: "#10B981",
    tasks: [
      { id: 10, name: "Reading", completionType: "duration", target: 20, unit: "min", frequency: "daily", basePoints: 10, pillarId: 5, completed: true, value: 25 },
      { id: 11, name: "Morning routine", completionType: "checkbox", target: null, unit: null, frequency: "daily", basePoints: 10, pillarId: 5, completed: true, value: null },
    ],
  },
];

// Generate demo history scores for the last 30 days
function generateDemoHistory() {
  const scores = [];
  const now = new Date();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().split("T")[0];
    const base = 45 + Math.round(Math.random() * 40);
    const actionScore = Math.min(100, Math.max(20, base + (i < 30 ? 10 : 0)));
    scores.push({
      date,
      actionScore,
      momentumScore: null,
      isPassing: actionScore >= 70,
      pillarScores: { "1": actionScore + 5, "2": actionScore - 5, "3": actionScore, "5": actionScore + 10 },
      pillarMomentum: {},
    });
  }
  return scores;
}

const demoHistory = generateDemoHistory();

export const DEMO_DASHBOARD = {
  score: {
    date: today,
    actionScore: 42,
    momentumScore: null,
    scoreTier: "Needs Work",
    pillarScores: [
      { id: 1, name: "Health & Fitness", emoji: "\u{1F4AA}", color: "#EF4444", weight: 25, score: 20 },
      { id: 2, name: "Career", emoji: "\u{1F4BC}", color: "#3B82F6", weight: 25, score: 67 },
      { id: 3, name: "Side Hustle", emoji: "\u{1F680}", color: "#8B5CF6", weight: 15, score: 0 },
      { id: 5, name: "Growth", emoji: "\u{1F4D6}", color: "#10B981", weight: 15, score: 100 },
    ],
    totalTasks: 11,
    completedTasks: 4,
  },
  stats: {
    totalXp: 1250,
    level: 3,
    levelTitle: "Consistent",
    currentStreak: 5,
    bestStreak: 12,
    levelInfo: {
      level: 3,
      title: "Consistent",
      currentXp: 1250,
      xpForNextLevel: 2000,
      xpProgress: 62.5,
    },
  },
  history: {
    scores: demoHistory,
    pillars: DEMO_PILLARS.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, color: p.color, weight: p.weight })),
  },
  momentum: {
    overall: 1.2,
    pillars: [],
    goals: [],
    trajectory: {
      overall: 1.1,
      goals: [],
    },
  },
  todayTaskCount: 11,
};

export const DEMO_OUTCOMES = [
  {
    id: 1,
    name: "Lose 10kg",
    goalType: "outcome",
    startValue: 90,
    currentValue: 85,
    targetValue: 80,
    unit: "kg",
    direction: "decrease",
    startDate: null,
    targetDate: "2026-06-30",
    pillarId: 1,
    pillarColor: "#EF4444",
    completionType: "numeric",
    dailyTarget: null,
  },
  {
    id: 2,
    name: "Run 5K without stopping",
    goalType: "target",
    startValue: 0,
    currentValue: 3.2,
    targetValue: 5,
    unit: "km",
    direction: "increase",
    startDate: null,
    targetDate: "2026-05-01",
    pillarId: 1,
    pillarColor: "#EF4444",
    completionType: "numeric",
    dailyTarget: null,
  },
  {
    id: 3,
    name: "Daily meditation",
    goalType: "habitual",
    startValue: 0,
    currentValue: 15,
    targetValue: 30,
    unit: "days",
    direction: "increase",
    startDate: "2026-02-01",
    targetDate: "2026-04-01",
    pillarId: 5,
    pillarColor: "#10B981",
    completionType: "checkbox",
    dailyTarget: 1,
  },
  {
    id: 4,
    name: "Read 12 books this year",
    goalType: "outcome",
    startValue: 0,
    currentValue: 3,
    targetValue: 12,
    unit: "books",
    direction: "increase",
    startDate: "2026-01-01",
    targetDate: "2026-12-31",
    pillarId: 5,
    pillarColor: "#10B981",
    completionType: "numeric",
    dailyTarget: null,
  },
  {
    id: 5,
    name: "Complete 100 LeetCode problems",
    goalType: "target",
    startValue: 0,
    currentValue: 34,
    targetValue: 100,
    unit: "problems",
    direction: "increase",
    startDate: "2026-01-15",
    targetDate: "2026-06-30",
    pillarId: 2,
    pillarColor: "#3B82F6",
    completionType: "numeric",
    dailyTarget: null,
  },
];

export const DEMO_CYCLES = [
  {
    id: 1,
    name: "Q1 2026 Sprint",
    startDate: "2026-01-05",
    endDate: "2026-03-29",
    vision: "Build strong habits and ship my side project MVP",
    theme: "Discipline & Execution",
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
  },
];
