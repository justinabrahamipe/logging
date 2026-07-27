import 'dotenv/config';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { createClient } from '@libsql/client';
import * as fs from 'fs';
import * as path from 'path';

const DROP_AUTH_TABLES_SQL = `
DROP TABLE IF EXISTS "session";
DROP TABLE IF EXISTS "account";
DROP TABLE IF EXISTS "verificationToken";
DROP TABLE IF EXISTS "user";
`;

const AUTH_TABLES_SQL = `
-- User table
CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  "name" text,
  "email" text NOT NULL,
  "emailVerified" integer,
  "image" text,
  "createdAt" integer DEFAULT (unixepoch()) NOT NULL,
  "updatedAt" integer DEFAULT (unixepoch()) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_email_unique" ON "user" ("email");

-- Account table
CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  "userId" text NOT NULL,
  "type" text NOT NULL,
  "provider" text NOT NULL,
  "providerAccountId" text NOT NULL,
  "refresh_token" text,
  "access_token" text,
  "expires_at" integer,
  "token_type" text,
  "scope" text,
  "id_token" text,
  "session_state" text,
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "account_provider_providerAccountId_unique" ON "account" ("provider","providerAccountId");

-- Session table
CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  "sessionToken" text NOT NULL,
  "userId" text NOT NULL,
  "expires" integer NOT NULL,
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS "session_sessionToken_unique" ON "session" ("sessionToken");
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("userId");

-- VerificationToken table
CREATE TABLE IF NOT EXISTS "verificationToken" (
  "identifier" text NOT NULL,
  "token" text NOT NULL,
  "expires" integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "verificationToken_token_unique" ON "verificationToken" ("token");
CREATE UNIQUE INDEX IF NOT EXISTS "verificationToken_identifier_token_unique" ON "verificationToken" ("identifier","token");
`;

const runMigrations = async () => {
  console.log('Starting database migrations...');
  console.log('Database URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');

  if (!process.env.DATABASE_URL || !process.env.DATABASE_AUTH_TOKEN) {
    throw new Error('DATABASE_URL and DATABASE_AUTH_TOKEN must be set');
  }

  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN!,
  });

  const db = drizzle(client);

  // First, ensure auth tables exist with proper schema
  console.log('Checking auth tables...');
  try {
    let needsRecreate = false;

    try {
      const tableInfo = await client.execute('PRAGMA table_info("account")');
      const idColumn = tableInfo.rows.find(r => r.name === 'id');

      if (!idColumn) {
        needsRecreate = true;
      } else if (!idColumn.dflt_value) {
        needsRecreate = true;
      }
    } catch {
      needsRecreate = true;
    }

    if (needsRecreate) {
      console.log('  -> Recreating auth tables with proper schema...');

      const dropStatements = DROP_AUTH_TABLES_SQL.split(';').filter(s => s.trim());
      for (const stmt of dropStatements) {
        if (stmt.trim()) {
          await client.execute(stmt);
        }
      }

      const createStatements = AUTH_TABLES_SQL.split(';').filter(s => s.trim());
      for (const stmt of createStatements) {
        if (stmt.trim()) {
          await client.execute(stmt);
        }
      }
      console.log('Auth tables recreated with proper schema');
    } else {
      console.log('Auth tables have correct schema');
    }
  } catch (error) {
    console.error('Error setting up auth tables:', error);
  }

  // Schema rename/cleanup migrations (idempotent)
  console.log('Running schema rename/cleanup...');
  const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
  const tableNames = tables.rows.map(r => r.name as string);

  // Rename Outcome → Goal
  if (tableNames.includes('Outcome') && !tableNames.includes('Goal')) {
    console.log('  Renaming Outcome → Goal...');
    await client.execute('ALTER TABLE "Outcome" RENAME TO "Goal"');
  }

  // Rename TwelveWeekYear → Cycle
  if (tableNames.includes('TwelveWeekYear') && !tableNames.includes('Cycle')) {
    console.log('  Renaming TwelveWeekYear → Cycle...');
    await client.execute('ALTER TABLE "TwelveWeekYear" RENAME TO "Cycle"');
  }

  // Rename Task.outcomeId → Task.goalId
  try {
    const taskInfo = await client.execute("PRAGMA table_info('Task')");
    const hasOutcomeId = taskInfo.rows.some(r => r.name === 'outcomeId');
    const hasGoalId = taskInfo.rows.some(r => r.name === 'goalId');
    if (hasOutcomeId && !hasGoalId) {
      console.log('  Renaming Task.outcomeId → Task.goalId...');
      await client.execute('ALTER TABLE "Task" RENAME COLUMN "outcomeId" TO "goalId"');
    }
  } catch (e: any) {
    console.log('  Column rename skipped:', e.message);
  }

  // Drop unused tables
  for (const t of ['OutcomeLog', 'WeeklyTarget', 'WeeklyReview', 'UserStats', 'TwelveWeekGoal', 'TwelveWeekTactic']) {
    if (tableNames.includes(t)) {
      console.log(`  Dropping ${t}...`);
      await client.execute(`DROP TABLE IF EXISTS "${t}"`);
    }
  }

  // Drop removed columns
  const colDrops: [string, string][] = [
    ['DailyScore', 'xpEarned'],
    ['DailyScore', 'streakBonus'],
    ['ActivityLog', 'outcomeLogId'],
    ['ActivityLog', 'goalLogId'],
    ['ActivityLog', 'reversalOf'],
    ['ActivityLog', 'note'],
    ['UserPreferences', 'weekdayPassThreshold'],
    ['UserPreferences', 'weekendPassThreshold'],
    ['Task', 'windowStart'],
    ['Task', 'windowEnd'],
    ['Task', 'importance'],
    ['Task', 'isWeekendTask'],
    ['Goal', 'tolerance'],
    ['Goal', 'linkedOutcomeId'],
  ];
  for (const [table, col] of colDrops) {
    try {
      const info = await client.execute(`PRAGMA table_info('${table}')`);
      if (info.rows.some(r => r.name === col)) {
        console.log(`  Dropping ${table}.${col}...`);
        await client.execute(`ALTER TABLE "${table}" DROP COLUMN "${col}"`);
      }
    } catch (e: any) {
      console.log(`  ${table}.${col} drop skipped:`, e.message);
    }
  }

  console.log('Schema rename/cleanup done.\n');

  // Get migration files
  const migrationsDir = path.join(process.cwd(), 'drizzle/migrations');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${migrationFiles.length} migration files`);

  // Check migrations table
  let appliedMigrations: Set<string> = new Set();

  try {
    const result = await client.execute('SELECT hash FROM "__drizzle_migrations"');
    result.rows.forEach(r => appliedMigrations.add(r.hash as string));
    console.log(`${appliedMigrations.size} migrations already applied`);
  } catch {
    console.log('No migrations table found');
  }

  // If some migrations are recorded but not all, run the pending ones
  const hasPending = appliedMigrations.size > 0 && migrationFiles.some(f => !appliedMigrations.has(f.replace('.sql', '')));
  if (hasPending) {
    const pendingCount = migrationFiles.filter(f => !appliedMigrations.has(f.replace('.sql', ''))).length;
    console.log(`\nFound ${pendingCount} pending migrations - running them...`);

    for (const file of migrationFiles) {
      const hash = file.replace('.sql', '');
      if (!appliedMigrations.has(hash)) {
        console.log(`  -> Running: ${file}`);
        const sqlContent = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        const statements = sqlContent.split('--> statement-breakpoint').map(s => s.trim()).filter(s => s);

        for (const stmt of statements) {
          if (stmt) {
            try {
              await client.execute(stmt);
            } catch (err: any) {
              if (stmt.toUpperCase().startsWith('DROP TABLE') && err.message?.includes('no such table')) {
                console.log(`    (Table already dropped, skipping)`);
              } else if (stmt.toUpperCase().includes('DROP COLUMN') && err.message?.includes('no such column')) {
                console.log(`    (Column already dropped, skipping)`);
              } else if (stmt.toUpperCase().includes('ADD') && err.message?.includes('duplicate column')) {
                console.log(`    (Column already exists, skipping)`);
              } else if (err.message?.includes('already exists')) {
                console.log(`    (Already exists, skipping)`);
              } else {
                throw err;
              }
            }
          }
        }

        await client.execute({
          sql: 'INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)',
          args: [hash, Date.now()]
        });
        appliedMigrations.add(hash);
        console.log(`  Done: ${file}`);
      }
    }
    console.log('Pending migrations complete!\n');
  }

  // If no migrations recorded at all, check if tables exist
  if (appliedMigrations.size === 0) {
    let tablesExist = false;
    try {
      const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__%'");
      tablesExist = tables.rows.length > 0;
      if (tablesExist) {
        console.log(`Found ${tables.rows.length} existing tables`);
      }
    } catch {
      console.log('Could not check existing tables');
    }

    if (tablesExist) {
      await client.execute(`
        CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          hash TEXT NOT NULL,
          created_at INTEGER
        )
      `);

      const firstMigration = migrationFiles[0];
      if (firstMigration) {
        const hash = firstMigration.replace('.sql', '');
        await client.execute({
          sql: 'INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)',
          args: [hash, Date.now()]
        });
        appliedMigrations.add(hash);
        console.log(`  Baselined initial schema: ${firstMigration}`);
      }

      for (let i = 1; i < migrationFiles.length; i++) {
        const file = migrationFiles[i];
        const hash = file.replace('.sql', '');

        console.log(`  -> Running: ${file}`);
        const sqlContent = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        const statements = sqlContent.split('--> statement-breakpoint').map(s => s.trim()).filter(s => s);

        for (const stmt of statements) {
          if (stmt) {
            try {
              await client.execute(stmt);
            } catch (err: any) {
              if (stmt.toUpperCase().startsWith('DROP TABLE') && err.message?.includes('no such table')) {
                console.log(`    (Table already dropped, skipping)`);
              } else if (stmt.toUpperCase().includes('DROP COLUMN') && err.message?.includes('no such column')) {
                console.log(`    (Column already dropped, skipping)`);
              } else if (stmt.toUpperCase().includes('ADD') && err.message?.includes('duplicate column')) {
                console.log(`    (Column already exists, skipping)`);
              } else if (err.message?.includes('already exists')) {
                console.log(`    (Already exists, skipping)`);
              } else {
                throw err;
              }
            }
          }
        }

        await client.execute({
          sql: 'INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)',
          args: [hash, Date.now()]
        });
        appliedMigrations.add(hash);
        console.log(`  Done: ${file}`);
      }
      console.log('Migration setup complete!\n');
    }
  }

  // If the custom runner already handled all migrations, we're done
  const allApplied = migrationFiles.every(f => appliedMigrations.has(f.replace('.sql', '')));
  if (allApplied) {
    console.log('All migrations applied successfully!');
  } else {
    // Fallback: run drizzle's migrate for any remaining
    console.log('Running migrations...');

    try {
      await migrate(db, { migrationsFolder: './drizzle/migrations' });
      console.log('Migrations completed successfully!');
    } catch (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
  }

  // Post-migration: recalculate trajectory scores with the new formula
  await recalcTrajectoryScores(client);

  // Add endDate column to TaskSchedule (idempotent)
  try {
    const tsInfo = await client.execute("PRAGMA table_info('TaskSchedule')");
    if (!tsInfo.rows.some(r => r.name === 'endDate')) {
      console.log('  Adding TaskSchedule.endDate column...');
      await client.execute('ALTER TABLE "TaskSchedule" ADD COLUMN "endDate" TEXT');
    }
  } catch (e: any) { console.log('  TaskSchedule.endDate:', e.message); }

  // Fix corrupt scheduleDays/customDays (one-time, idempotent)
  await fixScheduleDays(client);

  process.exit(0);
};

/**
 * Recalculate all historical trajectory scores using the new formula:
 * expected = startValue + range * timeProgress, deviation-based scoring.
 * Reconstructs historical currentValue for each date from task completion data.
 */
async function recalcTrajectoryScores(client: ReturnType<typeof createClient>) {
  console.log('\nRecalculating trajectory scores...');

  // Get all daily scores
  const scoresResult = await client.execute(
    'SELECT id, userId, date, trajectoryScore FROM DailyScore ORDER BY date ASC'
  );
  if (scoresResult.rows.length === 0) {
    console.log('  No daily scores found, skipping.');
    return;
  }

  // Get all outcome goals
  const goalsResult = await client.execute(
    "SELECT id, userId, pillarId, goalType, startValue, targetValue, currentValue, startDate, targetDate FROM Goal WHERE goalType = 'outcome'"
  );
  if (goalsResult.rows.length === 0) {
    console.log('  No outcome goals found, skipping.');
    return;
  }

  // Get all completed/progressed tasks linked to goals, sorted by date
  const tasksResult = await client.execute(
    'SELECT goalId, value, date, completed FROM Task WHERE goalId IS NOT NULL AND (completed = 1 OR value > 0) ORDER BY date ASC'
  );

  // Group goals by userId
  const goalsByUser = new Map<string, typeof goalsResult.rows>();
  for (const g of goalsResult.rows) {
    const uid = g.userId as string;
    const list = goalsByUser.get(uid) || [];
    list.push(g);
    goalsByUser.set(uid, list);
  }

  // Group tasks by goalId
  const tasksByGoal = new Map<number, typeof tasksResult.rows>();
  for (const t of tasksResult.rows) {
    const gid = t.goalId as number;
    const list = tasksByGoal.get(gid) || [];
    list.push(t);
    tasksByGoal.set(gid, list);
  }

  let updated = 0;
  for (const score of scoresResult.rows) {
    const userId = score.userId as string;
    const date = score.date as string;
    const userGoals = goalsByUser.get(userId) || [];
    if (userGoals.length === 0) continue;

    const trajectories: number[] = [];

    for (const goal of userGoals) {
      const startDate = (goal.startDate as string) || date;
      const endDate = (goal.targetDate as string) || date;
      const startValue = goal.startValue as number;
      const targetValue = goal.targetValue as number;

      if (date < startDate) { trajectories.push(1.0); continue; }

      const totalMs = new Date(endDate).getTime() - new Date(startDate).getTime();
      const elapsedMs = new Date(date > endDate ? endDate : date).getTime() - new Date(startDate).getTime();
      if (totalMs <= 0) { trajectories.push(1.0); continue; }

      const range = targetValue - startValue;
      if (range === 0) { trajectories.push(1.0); continue; }

      // Reconstruct currentValue as of this date
      const goalId = goal.id as number;
      const goalTasks = (tasksByGoal.get(goalId) || []).filter(t => (t.date as string) <= date);
      let currentValue: number;
      // Outcome goals use latest absolute value
      const withValue = goalTasks.filter(t => t.value != null && (t.value as number) > 0);
      currentValue = withValue.length > 0 ? withValue[withValue.length - 1].value as number : startValue;

      const timeProgress = elapsedMs / totalMs;
      const expectedValue = startValue + range * timeProgress;
      const deviation = (currentValue - expectedValue) / range;
      const trajectory = Math.round((1.0 + deviation) * 100) / 100;

      trajectories.push(trajectory);
    }

    if (trajectories.length === 0) continue;

    const overall = Math.round((trajectories.reduce((s, t) => s + t, 0) / trajectories.length) * 100) / 100;
    const newTrajectoryScore = Math.round(overall * 100);

    if (newTrajectoryScore !== score.trajectoryScore) {
      await client.execute({
        sql: 'UPDATE DailyScore SET trajectoryScore = ? WHERE id = ?',
        args: [newTrajectoryScore, score.id as number],
      });
      updated++;
      console.log(`  ${date}: ${score.trajectoryScore} -> ${newTrajectoryScore}`);
    }
  }

  console.log(`  Updated ${updated}/${scoresResult.rows.length} trajectory scores.`);
}

const SCHEDULE_DAY_MAP: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

function fixJsonDays(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every(n => typeof n === 'number')) return null;
  } catch { /* not valid JSON */ }
  const cleaned = raw.replace(/["\[\]]/g, '');
  const days = cleaned.split(',').map(s => SCHEDULE_DAY_MAP[s.trim().toLowerCase()]).filter(n => n !== undefined);
  if (days.length > 0) return JSON.stringify(days);
  const single = SCHEDULE_DAY_MAP[cleaned.trim().toLowerCase()];
  if (single !== undefined) return JSON.stringify([single]);
  return '[]';
}

async function fixScheduleDays(client: ReturnType<typeof createClient>) {
  console.log('\nFixing corrupt scheduleDays/customDays...');

  const goalsResult = await client.execute('SELECT id, name, scheduleDays FROM Goal WHERE scheduleDays IS NOT NULL');
  let goalFixed = 0;
  for (const row of goalsResult.rows) {
    const fixed = fixJsonDays(row.scheduleDays as string);
    if (fixed !== null) {
      await client.execute({ sql: 'UPDATE Goal SET scheduleDays = ? WHERE id = ?', args: [fixed, row.id as number] });
      console.log(`  Goal #${row.id} "${row.name}": "${row.scheduleDays}" -> ${fixed}`);
      goalFixed++;
    }
  }

  const schedsResult = await client.execute('SELECT id, name, customDays FROM TaskSchedule WHERE customDays IS NOT NULL');
  let schedFixed = 0;
  for (const row of schedsResult.rows) {
    const fixed = fixJsonDays(row.customDays as string);
    if (fixed !== null) {
      await client.execute({ sql: 'UPDATE TaskSchedule SET customDays = ? WHERE id = ?', args: [fixed, row.id as number] });
      console.log(`  Schedule #${row.id} "${row.name}": "${row.customDays}" -> ${fixed}`);
      schedFixed++;
    }
  }

  console.log(`  Fixed ${goalFixed} goals, ${schedFixed} task schedules.`);
}

runMigrations();
