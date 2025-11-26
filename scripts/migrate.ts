import 'dotenv/config';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { createClient } from '@libsql/client';
import * as fs from 'fs';
import * as path from 'path';

const AUTH_TABLES_SQL = `
-- User table
CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY NOT NULL,
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
  "id" text PRIMARY KEY NOT NULL,
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
  "id" text PRIMARY KEY NOT NULL,
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

  // First, ensure auth tables exist (these are critical for the app to work)
  console.log('Ensuring auth tables exist...');
  try {
    const statements = AUTH_TABLES_SQL.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      if (stmt.trim()) {
        await client.execute(stmt);
      }
    }
    console.log('✓ Auth tables ready');
  } catch (error) {
    console.error('Error creating auth tables:', error);
  }

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

  // If some migrations are recorded but not all, baseline the missing ones
  if (appliedMigrations.size > 0 && appliedMigrations.size < migrationFiles.length) {
    console.log(`\n→ Found ${migrationFiles.length - appliedMigrations.size} missing migration records - baselining...`);

    for (const file of migrationFiles) {
      const hash = file.replace('.sql', '');
      if (!appliedMigrations.has(hash)) {
        await client.execute({
          sql: 'INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)',
          args: [hash, Date.now()]
        });
        appliedMigrations.add(hash);
        console.log(`  ✓ Baselined: ${file}`);
      }
    }
    console.log('✓ Baseline complete!\n');
  }

  // If no migrations recorded at all, check if tables exist and baseline
  if (appliedMigrations.size === 0) {
    let tablesExist = false;
    try {
      const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__%'");
      tablesExist = tables.rows.length > 0;
      if (tablesExist) {
        console.log(`✓ Found ${tables.rows.length} existing tables - running full baseline...`);
      }
    } catch {
      console.log('→ Could not check existing tables');
    }

    if (tablesExist) {
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
        console.log(`  ✓ Baselined: ${file}`);
      }
      console.log('✓ Full baseline complete!\n');
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
