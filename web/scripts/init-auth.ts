import 'dotenv/config';
import { createClient } from '@libsql/client';

const initAuthTables = async () => {
  console.log('Initializing auth tables...');

  if (!process.env.DATABASE_URL || !process.env.DATABASE_AUTH_TOKEN) {
    throw new Error('DATABASE_URL and DATABASE_AUTH_TOKEN must be set');
  }

  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN!,
  });

  // Define SQL statements in order
  const statements = [
    // Create user table first (no dependencies)
    `CREATE TABLE IF NOT EXISTS "user" (
      "id" text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
      "name" text,
      "email" text NOT NULL,
      "emailVerified" integer,
      "image" text,
      "createdAt" integer DEFAULT (unixepoch()) NOT NULL,
      "updatedAt" integer DEFAULT (unixepoch()) NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "user_email_unique" ON "user" ("email")`,

    // Create account table (depends on user)
    `CREATE TABLE IF NOT EXISTS "account" (
      "id" text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
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
    )`,
    `CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("userId")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "account_provider_providerAccountId_unique" ON "account" ("provider","providerAccountId")`,

    // Create session table (depends on user)
    `CREATE TABLE IF NOT EXISTS "session" (
      "id" text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
      "sessionToken" text NOT NULL,
      "userId" text NOT NULL,
      "expires" integer NOT NULL,
      FOREIGN KEY ("userId") REFERENCES "user"("id") ON UPDATE no action ON DELETE cascade
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "session_sessionToken_unique" ON "session" ("sessionToken")`,
    `CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("userId")`,

    // Create verificationToken table (no dependencies)
    `CREATE TABLE IF NOT EXISTS "verificationToken" (
      "identifier" text NOT NULL,
      "token" text NOT NULL,
      "expires" integer NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "verificationToken_token_unique" ON "verificationToken" ("token")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "verificationToken_identifier_token_unique" ON "verificationToken" ("identifier","token")`
  ];

  try {
    // Execute each statement individually with error handling
    for (const stmt of statements) {
      try {
        await client.execute(stmt);
      } catch (err: any) {
        // Ignore "already exists" errors, but log others
        if (!err.message?.includes('already exists')) {
          console.log(`Warning: ${err.message}`);
        }
      }
    }

    console.log('✓ Auth tables initialized successfully!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Failed to initialize auth tables:', error);
    process.exit(1);
  }
};

initAuthTables();
