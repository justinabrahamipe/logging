import 'dotenv/config';
import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const initAuthTables = async () => {
  console.log('Initializing auth tables...');

  if (!process.env.DATABASE_URL || !process.env.DATABASE_AUTH_TOKEN) {
    throw new Error('DATABASE_URL and DATABASE_AUTH_TOKEN must be set');
  }

  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN!,
  });

  try {
    // Read the SQL file
    const sqlPath = join(__dirname, 'init-auth-tables.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    // Split by semicolon and filter out comments and empty lines
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    // Execute all statements in a batch
    await client.batch(statements.map(stmt => ({ sql: stmt, args: [] })), 'write');

    console.log('✓ Auth tables initialized successfully!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Failed to initialize auth tables:', error);
    process.exit(1);
  }
};

initAuthTables();
