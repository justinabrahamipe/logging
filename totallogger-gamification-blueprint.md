# TotalLogger Life Gamification System
## Complete Product Blueprint

**Created:** February 18, 2026  
**Author:** Justin Abraham Ipe  
**Status:** Ready for Development  
**Platform:** Web (responsive - mobile + desktop)  
**User Scope:** Personal use first, product-ready architecture

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Core Architecture](#2-core-architecture)
3. [Pillars System](#3-pillars-system)
4. [Tasks System](#4-tasks-system)
5. [Scoring Engine](#5-scoring-engine)
6. [Actions & Outcomes](#6-actions--outcomes)
7. [Streaks & Visualization](#7-streaks--visualization)
8. [XP & Levels System](#8-xp--levels-system)
9. [Logging System](#9-logging-system)
10. [Rewards System](#10-rewards-system)
11. [Reports](#11-reports)
12. [Additional Features](#12-additional-features)
13. [Database Schema](#13-database-schema)
14. [Build Phases](#14-build-phases)
15. [Seed Data (Justin's Setup)](#15-seed-data-justins-setup)

---

## 1. Executive Summary

### The Problem
You're consistent with things that give immediate dopamine (pizza, Netflix, gym) but struggle with tasks that have delayed gratification (career prep, side hustle, diet compliance).

### The Solution
A gamification system that provides immediate visual feedback, streaks, and scores for everything - making productive tasks as rewarding as ordering takeaway.

### Core Value Proposition
- **Action Score:** Daily points for what you did (100% in your control)
- **Progress Score:** Long-term outcome tracking (results over time)
- **Streaks:** Visual chain you don't want to break
- **XP & Levels:** Long-term progression and titles
- **Rewards:** Real-world rewards tied to achievements

---

## 2. Core Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        PILLARS                              │
│   (User-configurable life areas with % weights)             │
│   Health 25% | Career 25% | Hustle 15% | Home 10% | etc.   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         TASKS                               │
│   Types: Checkbox | Count | Duration | Numeric | Percentage │
│   Flexibility: Must Today | Window | Limit/Avoid | Carryover│
│   Importance: High (3x) | Medium (2x) | Low (1x)            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     SCORING ENGINE                          │
│            Proportional scoring (80% done = 80% pts)        │
│                  Importance multipliers                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        OUTPUTS                              │
│  Daily Score | Streaks | XP/Levels | Reports | Rewards      │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Pillars System

### Overview
Pillars are life areas that tasks belong to. Users can customize pillars, weights, colors, and emojis.

### Default Template

| Pillar | Default Weight | Emoji | Color |
|--------|----------------|-------|-------|
| Health & Fitness | 25% | 🏋️ | Blue |
| Career | 25% | 💼 | Purple |
| Side Hustle | 15% | 💰 | Green |
| Home & Cleanliness | 10% | 🧹 | Orange |
| Growth & Habits | 15% | 📚 | Teal |
| Family & Faith | 10% | 💒 | Pink |

### Customization Features

| Feature | Description |
|---------|-------------|
| Custom emoji picker | User selects any emoji |
| Custom color | User picks pillar color |
| Pillar descriptions | Optional description text |
| Archive pillar | Hide but keep history |
| Weight validation | Auto-fill remaining % to last pillar |

### Rules
- Minimum 1 pillar required
- Weights auto-fill (no manual 100% calculation needed)
- Archived pillars retain historical data

---

## 4. Tasks System

### 4.1 Completion Types

| Type | Example | UI Element |
|------|---------|------------|
| **Checkbox** | "Take supplements" | Toggle |
| **Count** | "Drink 8 glasses water" | Counter (5/8) |
| **Duration** | "Read for 30 mins" | Timer (start/stop) + manual |
| **Numeric** | "Hit 208g protein" | Number input |
| **Percentage** | "Complete project section" | Slider 0-100% |

### 4.2 Flexibility Rules

| Rule | Example | Behavior |
|------|---------|----------|
| **Must do today** | "Take supplements" | No flexibility. Miss = 0 pts |
| **Window-based** | "Cut nails (day 7-12)" | Complete anytime in window. Hidden until window opens |
| **Limit/Avoid** | "Social media < 30 mins" | Stay under = earn pts. Exceed = LOSE pts (negative) |
| **Carryover** | "Finish report" | User manually reschedules if missed |

### 4.3 Importance Levels

| Level | Multiplier | Use for |
|-------|------------|---------|
| High | 3x | Critical daily tasks |
| Medium | 2x | Important but flexible |
| Low | 1x | Nice-to-have |

### 4.4 Frequency Options

- **Daily** - Every day
- **Weekly** - Once per week
- **Custom days** - e.g., Mon/Tue/Thu/Fri (like gym schedule)

### 4.5 Weekend Handling

| Feature | Decision |
|---------|----------|
| Weekend days | Saturday + Sunday |
| Weekend tasks | Separate task list from weekdays |
| Weekend threshold | User sets different pass threshold |

---

## 5. Scoring Engine

### 5.1 Daily Score Calculation

```
Daily Score = Sum of (Task Score x Importance Multiplier)

Where Task Score = 
  - Checkbox: 0 or max points
  - Count/Duration/Numeric: (actual / target) x max points
  - Percentage: (percentage / 100) x max points
  - Limit/Avoid: under limit = +pts, over = -pts
```

### 5.2 Scoring Rules

| Rule | Description |
|------|-------------|
| Proportional | 80% done = 80% of points |
| Negative scoring | Limit/Avoid tasks can subtract points |
| Pass threshold | 70+ = passing day (green) |
| Fail threshold | <70 = red mark on calendar |

### 5.3 Score Tiers

| Score | Rating | Visual |
|-------|--------|--------|
| 90-100 | LEGENDARY | Fire |
| 80-89 | Excellent | Strong |
| 70-79 | Good | Check |
| 60-69 | Okay | Neutral |
| 50-59 | Weak | Warning |
| <50 | Failed | Skull |

---

## 6. Actions & Outcomes

### 6.1 Concept

| Type | What it is | Example | Control |
|------|------------|---------|---------|
| **Actions** (Leading) | Daily tasks/inputs | Gym, diet, applications | 100% in your control |
| **Outcomes** (Lagging) | Results over time | Weight, body fat, job offers | Indirect only |

### 6.2 Two Separate Scores

| Score | Based on | Updates |
|-------|----------|---------|
| **Action Score** | Daily task completion | Daily |
| **Progress Score** | Outcome progress toward goals | Per outcome frequency |

### 6.3 Outcome Configuration

| Setting | Options |
|---------|---------|
| Logging frequency | User sets per outcome (daily, weekly, etc.) |
| Data entry | Manual + future device sync (Apple Health, Google Fit) |
| Progress calculation | Both views available (from start + from target) |
| Link to actions | Optional - user can link actions to outcomes |

### 6.4 Display

Combined dashboard showing both scores:

```
TODAY
Action Score: 82/100  [========--]  GOOD

OUTCOMES
Weight:    98.6kg to 90kg   [=====-----]  38%
Body Fat:  25.7% to 15%     [====------]  40%
```

---

## 7. Streaks & Visualization

### 7.1 Streak Rules

| Rule | Decision |
|------|----------|
| Pass threshold | 70+ score = passing day |
| Failed day | Red mark on calendar, streak CONTINUES |
| Streak display | Both views: GitHub heatmap + flame chain |

### 7.2 Visualizations

| Chart | Description |
|-------|-------------|
| Daily score line chart | Score over time |
| Pillar breakdown bar chart | Score by pillar |
| Week-over-week comparison | This week vs last week |
| Monthly summary stats | Averages, totals |
| Best/worst day highlights | Top and bottom days |

### 7.3 Calendar Heatmap

```
Feb 2026
Mo Tu We Th Fr Sa Su
                1  2
 3  4  5  6  7  8  9
10 11 12 13 14 15 16
17 18 ...

Legend: Green = 90+ | Yellow = 70-89 | Red = <70
```

---

## 8. XP & Levels System

### 8.1 XP Earning

| Source | XP Earned |
|--------|-----------|
| Daily Action Score | Score x 1 (85 score = 85 XP) |
| Streak Bonus | +10% per 7-day streak |
| Passing Day (70+) | +10 XP bonus |
| Perfect Day (95+) | +25 XP bonus |

**Example:**
- Score 85 = 85 XP base
- 14-day streak = +20% = 102 XP
- Passing day = +10 XP
- **Total: 112 XP**

### 8.2 Level Progression (Milestone-based)

| Level | Total XP | Title |
|-------|----------|-------|
| 1 | 0 | Beginner |
| 2 | 100 | Starter |
| 3 | 250 | Committed |
| 4 | 500 | Consistent |
| 5 | 1,000 | Dedicated |
| 6 | 1,750 | Disciplined |
| 7 | 2,750 | Achiever |
| 8 | 4,000 | High Performer |
| 9 | 5,500 | Elite |
| 10 | 7,500 | Master |
| 11+ | +2,500/level | Legend I, II, III... |

### 8.3 Display

```
Level 7: Achiever
[============------]  2,890 / 4,000
1,110 XP to Level 8
```

---

## 9. Logging System

### 9.1 Core Principle: Append-Only

**Never delete. Always traceable.**

| Action | Log Entry | Effect |
|--------|-----------|--------|
| Complete task | +8 pts | Points added |
| Undo completion | -8 pts (reversal) | New entry subtracts |
| Add count | +3 count | Progress logged |
| Remove count | -1 count (reversal) | New entry subtracts |
| Edit numeric | -20 adjustment | Difference logged |

### 9.2 Log Entry Schema

```typescript
interface LogEntry {
  id: string;
  timestamp: string;
  taskId: string;
  pillarId: string;
  action: 'complete' | 'reverse' | 'adjust' | 'add' | 'subtract';
  previousValue: number | boolean | null;
  newValue: number | boolean;
  delta: number;
  pointsBefore: number;
  pointsAfter: number;
  pointsDelta: number;
  source: 'manual' | 'timer' | 'auto';
  reversalOf?: string;
  note?: string;
}
```

### 9.3 Log Features

| Feature | Decision |
|---------|----------|
| Retention | Keep forever |
| Visibility | User sees own actions only |
| Views | Day log, filter by pillar/task, date range search |

---

## 10. Rewards System

### 10.1 Concept

Users set real-world rewards tied to achievements. When trigger is met, reward unlocks and can be claimed guilt-free.

### 10.2 Trigger Types

| Trigger | Example |
|---------|---------|
| Outcome-based | Hit 90kg weight |
| Streak-based | 30-day streak |
| Task completion | Complete first 10K run |
| Level-based | Reach Level 10 |
| Cumulative | Complete 50 gym sessions |
| Time-based | Stay consistent for 3 months |

### 10.3 Reward Flow

```
Set Reward --> Trigger Met --> Unlocked --> Claim --> Date Logged
```

### 10.4 Setup
- User sets reward when creating the goal/trigger
- Claim action: Mark as claimed + date logged

---

## 11. Reports

### 11.1 Weekly Reports

| Metric | Description |
|--------|-------------|
| Average daily score | Mean of 7 days |
| Best/worst days | Highest and lowest |
| Pillar breakdown | Score per pillar |
| Streak summary | Current and best |
| XP earned | Total for week |
| Outcome progress | Changes in outcomes |
| Most completed tasks | Top performers |
| Most skipped tasks | Problem areas |

### 11.2 Monthly Reports

Everything in weekly, plus:
- Month-over-month comparison
- Trend analysis
- Long-term patterns

### 11.3 Delivery

| Method | Description |
|--------|-------------|
| Auto-generated | Every Sunday (weekly), 1st of month (monthly) |
| On-demand | User can view anytime |

---

## 12. Additional Features

### 12.1 MVP Features

| Feature | Description |
|---------|-------------|
| Dark mode | Default to device setting, can override |
| Focus mode | Hide everything except today's tasks |
| Morning briefing | Simple stats (no AI for MVP) |

### 12.2 Future Features (Post-MVP)

| Feature | Description |
|---------|-------------|
| AI Coach | Claude API integration for personalized insights |
| Offline mode | Sync when back online |
| Voice input | "Log gym done" |
| API access | Connect to other apps |
| Public profile | Share streaks/level with others |

### 12.3 AI Integration (Paid Feature)

```
Pricing Model:
- Tracking: FREE
- AI features: PAID (usage-based or subscription)

AI Features:
- Smart morning briefing
- Pattern detection ("You skip gym after bad sleep")
- Personalized recommendations
```

---

## 13. Database Schema

### 13.1 Core Tables

```typescript
// Pillars
interface Pillar {
  id: string;
  userId: string;
  name: string;
  emoji: string;
  color: string;
  weight: number;
  description?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

// Tasks
interface Task {
  id: string;
  pillarId: string;
  userId: string;
  name: string;
  
  // Type
  completionType: 'checkbox' | 'count' | 'duration' | 'numeric' | 'percentage';
  target?: number;
  unit?: string;
  
  // Flexibility
  flexibilityRule: 'must_today' | 'window' | 'limit_avoid' | 'carryover';
  windowStart?: number;
  windowEnd?: number;
  limitValue?: number;
  
  // Importance
  importance: 'high' | 'medium' | 'low';
  
  // Frequency
  frequency: 'daily' | 'weekly' | 'custom';
  customDays?: number[];
  isWeekendTask: boolean;
  
  // Points
  basePoints: number;
  
  createdAt: string;
  updatedAt: string;
}

// Task Completions
interface TaskCompletion {
  id: string;
  taskId: string;
  userId: string;
  date: string;
  completed: boolean;
  value?: number;
  pointsEarned: number;
  completedAt?: string;
  updatedAt: string;
}

// Outcomes
interface Outcome {
  id: string;
  userId: string;
  pillarId?: string;
  name: string;
  targetValue: number;
  startValue: number;
  currentValue: number;
  unit: string;
  direction: 'decrease' | 'increase';
  logFrequency: 'daily' | 'weekly' | 'custom';
  targetDate?: string;
  createdAt: string;
  updatedAt: string;
}

// Outcome Logs
interface OutcomeLog {
  id: string;
  outcomeId: string;
  userId: string;
  value: number;
  loggedAt: string;
  source: 'manual' | 'device_sync';
  note?: string;
}

// Activity Log (Immutable)
interface ActivityLog {
  id: string;
  userId: string;
  timestamp: string;
  entityType: 'task' | 'outcome';
  entityId: string;
  pillarId?: string;
  action: 'complete' | 'reverse' | 'adjust' | 'add' | 'subtract';
  previousValue: number | boolean | null;
  newValue: number | boolean;
  delta: number;
  pointsBefore: number;
  pointsAfter: number;
  pointsDelta: number;
  source: 'manual' | 'timer' | 'auto';
  reversalOf?: string;
  note?: string;
}

// Daily Scores
interface DailyScore {
  id: string;
  userId: string;
  date: string;
  actionScore: number;
  progressScore: number;
  pillarScores: Record<string, number>;
  xpEarned: number;
  streakBonus: number;
  isPassing: boolean;
  createdAt: string;
  updatedAt: string;
}

// User Stats
interface UserStats {
  id: string;
  userId: string;
  totalXp: number;
  level: number;
  levelTitle: string;
  currentStreak: number;
  bestStreak: number;
  updatedAt: string;
}

// Rewards
interface Reward {
  id: string;
  userId: string;
  name: string;
  description?: string;
  triggerType: 'outcome' | 'streak' | 'task' | 'level' | 'cumulative' | 'time';
  triggerEntityId?: string;
  triggerValue: number;
  isUnlocked: boolean;
  unlockedAt?: string;
  isClaimed: boolean;
  claimedAt?: string;
  createdAt: string;
}
```

---

## 14. Build Phases

### Phase 1: Core Foundation (Week 1-2)
- [ ] Pillar CRUD (create, edit, archive, reorder)
- [ ] Task CRUD with all completion types
- [ ] Basic daily checklist UI
- [ ] Simple scoring calculation
- [ ] Daily score display

### Phase 2: Completion & Logging (Week 3-4)
- [ ] All completion type UIs (checkbox, count, duration timer, numeric, percentage)
- [ ] Flexibility rules (must today, window, limit/avoid, carryover)
- [ ] Immutable activity log
- [ ] Undo/reversal functionality
- [ ] Log viewing (day, filter, search)

### Phase 3: Streaks & Visualization (Week 5-6)
- [ ] Streak calculation
- [ ] Calendar heatmap view
- [ ] Flame chain view
- [ ] Daily score line chart
- [ ] Pillar breakdown chart

### Phase 4: XP & Levels (Week 7)
- [ ] XP calculation with bonuses
- [ ] Level progression
- [ ] Level display with title and progress bar

### Phase 5: Outcomes (Week 8-9)
- [ ] Outcome CRUD
- [ ] Progress calculation (from start, from target)
- [ ] Progress Score
- [ ] Combined dashboard
- [ ] Optional action to outcome linking

### Phase 6: Reports (Week 10)
- [ ] Weekly report generation
- [ ] Monthly report generation
- [ ] Auto-generation on schedule
- [ ] On-demand viewing

### Phase 7: Rewards (Week 11)
- [ ] Reward CRUD
- [ ] Trigger detection (all 6 types)
- [ ] Unlock notifications
- [ ] Claim functionality

### Phase 8: Polish (Week 12+)
- [ ] Dark mode
- [ ] Focus mode
- [ ] Morning briefing (simple)
- [ ] Weekend task handling
- [ ] Mobile responsiveness
- [ ] Performance optimization

---

## 15. Seed Data (Justin's Setup)

### 15.1 Pillars

| Pillar | Weight | Tasks |
|--------|--------|-------|
| Health & Fitness | 25% | Gym, C25K, protein, calories, supplements |
| Career | 25% | LeetCode, DSA, deep-dive, interview Qs, applications |
| Side Hustle | 15% | Product work, YouTube content |
| Home | 10% | Kitchen, living area, vacuum/mop |
| Growth | 15% | Bible writing, reading, morning routine |
| Family & Faith | 10% | Family time, church duties |

### 15.2 Sample Tasks

**Health & Fitness:**

| Task | Type | Target | Frequency | Importance |
|------|------|--------|-----------|------------|
| Gym session | Checkbox | - | Mon/Tue/Thu/Fri | High |
| C25K run | Checkbox | - | Mon/Wed/Fri | High |
| Hit protein target | Numeric | 208g | Daily | High |
| Stay in calories | Numeric | 2040 cal | Daily | Medium |
| Take supplements | Checkbox | - | Daily | Low |
| Water intake | Count | 8 glasses | Daily | Medium |
| Social media limit | Limit/Avoid | 30 mins | Daily | Medium |

**Career:**

| Task | Type | Target | Frequency | Importance |
|------|------|--------|-----------|------------|
| LeetCode problem | Count | 1 | Daily | High |
| DSA concept | Checkbox | - | Daily | Medium |
| Deep-dive topic | Duration | 15 mins | Daily | Medium |
| Interview questions | Count | 2 | Daily | Medium |
| Job application | Count | 1 | Daily | High |

### 15.3 Sample Outcomes

| Outcome | Current | Target | Direction |
|---------|---------|--------|-----------|
| Weight | 98.6 kg | 90 kg | Decrease |
| Body Fat | 25.7% | 15% | Decrease |
| Skeletal Muscle | 40.1 kg | 42 kg | Increase |

### 15.4 Sample Rewards

| Reward | Trigger |
|--------|---------|
| Garmin watch | Complete 10K run |
| New wardrobe | Hit 90kg weight |
| Weekend trip | Reach Level 10 |
| Nice dinner | Ship Churchly MVP |

---

## Summary

This blueprint defines a comprehensive life gamification system that:

1. **Solves your core problem:** Provides immediate dopamine feedback for productive tasks
2. **Separates control:** Actions (what you do) vs Outcomes (results)
3. **Maintains integrity:** Immutable logging with reversal-based undo
4. **Motivates long-term:** XP, levels, streaks, and real-world rewards
5. **Scales to users:** Built with product-ready architecture

**Next step:** Start Phase 1 - build pillar and task CRUD with basic scoring.

---

*Blueprint generated: February 18, 2026*
