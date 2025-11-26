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
    console.log(`✓ ${appliedMigrations.size} migrations already applied`);
  } catch {
    console.log('→ No migrations table found');
  }

  // Check if any tables exist (to detect if we need baseline)
  let tablesExist = false;
  try {
    const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__%'");
    tablesExist = tables.rows.length > 0;
    if (tablesExist) {
      console.log(`✓ Found ${tables.rows.length} existing tables`);
    }
  } catch {
    console.log('→ Could not check existing tables');
  }

  // If tables exist but no migrations recorded, baseline ALL migrations
  if (tablesExist && appliedMigrations.size === 0) {
    console.log('\n→ Tables exist but no migrations recorded - running full baseline...');

    await client.execute(`
      CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT NOT NULL,
        created_at INTEGER
      )
    `);

    for (const file of migrationFiles) {
      const hash = file.replace('.sql', '');
      await client.execute({
        sql: 'INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)',
        args: [hash, Date.now()]
      });
      appliedMigrations.add(hash);
      console.log(`  ✓ Baselined: ${file}`);
    }
    console.log('✓ Baseline complete!\n');
  }

  // If some migrations recorded but not all, baseline the missing ones
  // (This handles partial state where tables exist from push but not all migrations recorded)
  if (tablesExist && appliedMigrations.size > 0 && appliedMigrations.size < migrationFiles.length) {
    console.log('\n→ Checking for missing migration records...');

    for (const file of migrationFiles) {
      const hash = file.replace('.sql', '');
      if (!appliedMigrations.has(hash)) {
        await client.execute({
          sql: 'INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)',
          args: [hash, Date.now()]
        });
        appliedMigrations.add(hash);
        console.log(`  ✓ Baselined missing: ${file}`);
      }
    }
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
