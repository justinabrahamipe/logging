import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

const client = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN!,
});

async function migrate() {
  console.log('Starting migration...');

  // 1. Check which tables exist
  const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
  const tableNames = tables.rows.map(r => r.name as string);
  console.log('Existing tables:', tableNames);

  // 2. Rename Outcome → Goal (if Outcome exists and Goal doesn't)
  if (tableNames.includes('Outcome') && !tableNames.includes('Goal')) {
    console.log('Renaming Outcome → Goal...');
    await client.execute('ALTER TABLE "Outcome" RENAME TO "Goal"');
  }

  // 3. Rename TwelveWeekYear → Cycle (if TwelveWeekYear exists and Cycle doesn't)
  if (tableNames.includes('TwelveWeekYear') && !tableNames.includes('Cycle')) {
    console.log('Renaming TwelveWeekYear → Cycle...');
    await client.execute('ALTER TABLE "TwelveWeekYear" RENAME TO "Cycle"');
  }

  // 4. Rename outcomeId → goalId on Task table (if column exists)
  try {
    const taskInfo = await client.execute("PRAGMA table_info('Task')");
    const hasOutcomeId = taskInfo.rows.some(r => r.name === 'outcomeId');
    const hasGoalId = taskInfo.rows.some(r => r.name === 'goalId');
    if (hasOutcomeId && !hasGoalId) {
      console.log('Renaming Task.outcomeId → Task.goalId...');
      await client.execute('ALTER TABLE "Task" RENAME COLUMN "outcomeId" TO "goalId"');
    }
  } catch (e) {
    console.log('Column rename skipped:', (e as Error).message);
  }

  // 5. Drop unused tables
  const tablesToDrop = [
    'OutcomeLog',
    'WeeklyTarget',
    'WeeklyReview',
    'UserStats',
    'TwelveWeekGoal',
    'TwelveWeekTactic',
  ];

  for (const table of tablesToDrop) {
    if (tableNames.includes(table)) {
      console.log(`Dropping ${table}...`);
      await client.execute(`DROP TABLE IF EXISTS "${table}"`);
    }
  }

  // 6. Remove xpEarned and streakBonus from DailyScore if they exist
  try {
    const dsInfo = await client.execute("PRAGMA table_info('DailyScore')");
    const cols = dsInfo.rows.map(r => r.name as string);
    // SQLite doesn't support DROP COLUMN before 3.35.0, but Turso/libsql does
    if (cols.includes('xpEarned')) {
      console.log('Dropping DailyScore.xpEarned...');
      await client.execute('ALTER TABLE "DailyScore" DROP COLUMN "xpEarned"');
    }
    if (cols.includes('streakBonus')) {
      console.log('Dropping DailyScore.streakBonus...');
      await client.execute('ALTER TABLE "DailyScore" DROP COLUMN "streakBonus"');
    }
  } catch (e) {
    console.log('DailyScore column drop skipped:', (e as Error).message);
  }

  // 7. Remove goalLogId from ActivityLog if it exists
  try {
    const alInfo = await client.execute("PRAGMA table_info('ActivityLog')");
    const cols = alInfo.rows.map(r => r.name as string);
    if (cols.includes('goalLogId')) {
      console.log('Dropping ActivityLog.goalLogId...');
      await client.execute('ALTER TABLE "ActivityLog" DROP COLUMN "goalLogId"');
    }
  } catch (e) {
    console.log('ActivityLog column drop skipped:', (e as Error).message);
  }

  // Verify final state
  const finalTables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  console.log('\nFinal tables:', finalTables.rows.map(r => r.name));
  console.log('Migration complete!');
}

migrate().catch(console.error);
