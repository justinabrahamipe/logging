# TotalLogger Life Gamification System
## Complete Product Blueprint

**Created:** February 18, 2026
**Author:** Justin Abraham Ipe
**Status:** In Development
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
10. [Reports](#10-reports)
11. [The 12 Week Year Module](#11-the-12-week-year-module-optional--future)
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
│  Daily Score | Streaks | XP/Levels | Reports                │
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
- Pillars are optional — tasks can exist without a pillar ("No Pillar" group)
- Weights auto-fill (no manual 100% calculation needed)
- Archived pillars retain historical data

---

## 4. Tasks System

### Overview
Single unified `/tasks` page with two views:
- **Today** (default) — shows today's tasks with completion UI (checkbox, count, timer, etc.) and score summary bar
- **All** — shows all tasks for CRUD management without completion controls

Tasks can optionally belong to a pillar. Each task row has a 3-dot menu for edit, duplicate, and delete.

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
- **Ad-hoc** - One-time task, only appears on the day it was created

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

## 10. Reports

### 10.1 Weekly Reports

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

### 10.2 Monthly Reports

Everything in weekly, plus:
- Month-over-month comparison
- Trend analysis
- Long-term patterns

### 10.3 Delivery

| Method | Description |
|--------|-------------|
| Auto-generated | Every Sunday (weekly), 1st of month (monthly) |
| On-demand | User can view anytime |

---

## 11. The 12 Week Year Module (Optional / Future)

### 11.1 Overview

The 12 Week Year treats 12 weeks like a full year - creating urgency and focus. This is an optional module users can enable.

### 11.2 Core Features

| Feature | Description |
|---------|-------------|
| 12-week goal setting | Define cycle with specific targets |
| Weekly breakdown | Auto-calculate targets (with override) |
| Weekly review | Score progress against plan |
| Progress dashboard | Visual 12-week view |
| Rollover | Carry incomplete to next cycle |

### 11.3 Weekly Target Calculation

```
12-Week Goal: 75 LeetCode problems
Weekly Target: 75 ÷ 12 = 6.25 → 6 problems/week

User can override any week (e.g., vacation week = 2, heavy week = 10)
```

### 11.4 Weekly Scoring Tiers

| Score | Rating | Visual |
|-------|--------|--------|
| 100%+ | Exceeded | Fire |
| 80-99% | Good | Check |
| 60-79% | Partial | Neutral |
| <60% | Missed | X |

### 11.5 Missed Target Handling

Missed targets spread across remaining weeks:

```
Week 1: Target 6, Actual 4 (missed 2)
Remaining: 11 weeks
New weekly target: 6 + (2 ÷ 11) = 6.18

System tracks fractional, displays rounded
```

### 11.6 Integration Options

| Feature | Options |
|---------|---------|
| Link to Outcomes | User chooses per goal (can link or keep separate) |
| Actions → Goals | Auto-suggest connection, user confirms |
| Review day | User chooses (Monday, Sunday, etc.) |

### 11.7 12-Week Dashboard

```
12 WEEK YEAR: "Q1 2026 Transformation"
Feb 17 - May 11, 2026                              Week 4/12

GOALS                              Target    Progress   Status
├─ Weight loss                     90kg      96.2kg     On Track
├─ LeetCode problems               75        28/75      Ahead
├─ Job applications                36        10/36      Behind
└─ Side hustle hours               60hrs     18/60      On Track

WEEKLY BREAKDOWN
Wk1 ✅ | Wk2 ✅ | Wk3 😐 | Wk4 [IN PROGRESS] | Wk5-12 ░░░░░░░░
```

### 11.8 Schema Additions

```typescript
interface TwelveWeekYear {
  id: string;
  userId: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
}

interface TwelveWeekGoal {
  id: string;
  periodId: string;
  userId: string;
  name: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  linkedOutcomeId?: string;
  linkedTaskIds?: string[];
  createdAt: string;
}

interface WeeklyTarget {
  id: string;
  goalId: string;
  periodId: string;
  weekNumber: number;
  targetValue: number;
  actualValue: number;
  isOverridden: boolean;
  score: 'exceeded' | 'good' | 'partial' | 'missed';
  reviewedAt?: string;
}
```

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
| AI Coach | AI integration for personalized insights |
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
  pillarId?: string;  // Optional — tasks can exist without a pillar
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
  frequency: 'daily' | 'weekly' | 'custom' | 'adhoc';
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
```

---

## 14. Build Phases

### Phase 1: Core Foundation — DONE
- [x] Pillar CRUD (create, edit, archive, reorder)
- [x] Task CRUD with all completion types
- [x] Unified Tasks page (Today filter with completion UI + All filter for management)
- [x] Simple scoring calculation
- [x] Daily score display
- [x] Ad-hoc (one-time) tasks
- [x] Optional pillar (tasks can exist without a pillar)
- [x] Task actions via 3-dot menu (edit, duplicate, delete)

### Phase 2: Completion & Logging — DONE
- [x] All completion type UIs (checkbox, count, duration timer, numeric, percentage)
- [x] Flexibility rules (must today, window, limit/avoid, carryover)
- [x] Immutable activity log
- [x] Undo/reversal functionality
- [x] Log viewing (day, filter, search) — Activity page

### Phase 3: Streaks & Visualization — DONE
- [x] Streak calculation (basic — currentStreak/bestStreak in UserStats)
- [x] Calendar heatmap view
- [x] Flame chain view
- [x] Daily score line chart
- [x] Pillar breakdown chart (bar/pie)

### Phase 4: XP & Levels — DONE
- [x] XP calculation with streak bonuses
- [x] Level progression (1-10+ with titles)
- [x] Level display with title and progress bar on dashboard

### Phase 5: Outcomes — DONE
- [x] Outcome CRUD
- [x] Progress calculation (from start, from target)
- [x] Progress Score
- [x] Combined dashboard
- [x] Optional action to outcome linking

### Phase 6: Reports — DONE
- [x] Weekly report generation
- [x] Monthly report generation
- [x] Auto-generation on schedule (Vercel cron: weekly Monday 9am UTC, monthly 1st 9am UTC)
- [x] On-demand viewing
- [x] Saved reports tab (stored JSON, instant load)

### Phase 7: Polish
- [x] Dark mode + light mode + system preference
- [x] Focus mode
- [x] Morning briefing (simple)
- [x] Weekend task handling (weekend-only flag, separate thresholds in settings)
- [x] Mobile responsiveness
- [x] PWA support (installable)
- [x] Performance optimization (skeleton loaders, client-side caching)

### Phase 8: 12 Week Year (Future)
- [ ] 12-week cycle CRUD (create, name, start/end date)
- [ ] Goal setting within cycles
- [ ] Weekly target auto-calculation with override
- [ ] Weekly review and scoring
- [ ] Missed target redistribution
- [ ] 12-week dashboard visualization
- [ ] Link to existing Outcomes (optional)

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

---

## Summary

This blueprint defines a comprehensive life gamification system that:

1. **Solves your core problem:** Provides immediate dopamine feedback for productive tasks
2. **Separates control:** Actions (what you do) vs Outcomes (results)
3. **Maintains integrity:** Immutable logging with reversal-based undo
4. **Motivates long-term:** XP, levels, and streaks
5. **Scales to users:** Built with product-ready architecture

**Next step:** Start Phase 1 - build pillar and task CRUD with basic scoring.

---

*Blueprint generated: February 18, 2026*
