import 'dotenv/config';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { createClient } from '@libsql/client';
import * as fs from 'fs';
import * as path from 'path';

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

  // Check if migrations table exists and has records
  let migrationsExist = false;
  let tablesExist = false;

  try {
    const migrationCheck = await client.execute('SELECT COUNT(*) as count FROM "__drizzle_migrations"');
    migrationsExist = (migrationCheck.rows[0]?.count as number) > 0;
    console.log('✓ Migrations table exists, records:', migrationCheck.rows[0]?.count);
  } catch {
    console.log('→ No migrations table found');
  }

  // Check if main tables exist (indicating previous push was used)
  try {
    await client.execute('SELECT 1 FROM "account" LIMIT 1');
    tablesExist = true;
    console.log('✓ Database tables exist');
  } catch {
    console.log('→ Database tables not found (fresh database)');
  }

  // If tables exist but no migration records, we need to baseline
  if (tablesExist && !migrationsExist) {
    console.log('\n→ Tables exist but no migration records - running baseline...');

    // Create migrations table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT NOT NULL,
        created_at INTEGER
      )
    `);

    // Get migration files and mark them as applied
    const migrationsDir = path.join(process.cwd(), 'drizzle/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const hash = file.replace('.sql', '');
      await client.execute({
        sql: 'INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)',
        args: [hash, Date.now()]
      });
      console.log(`  ✓ Baselined: ${file}`);
    }

    console.log('✓ Baseline complete!\n');
  }

  // Now run migrations (will skip already-applied ones)
  console.log('Running migrations...');

  try {
    await migrate(db, { migrationsFolder: './drizzle/migrations' });
    console.log('✓ Migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Migration failed:', error);
    process.exit(1);
  }
};

runMigrations();
