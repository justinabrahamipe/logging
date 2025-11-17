import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from '../drizzle/schema';

// Diagnostic logging
const tokenStart = process.env.DATABASE_AUTH_TOKEN?.substring(0, 70);
const expectedStart = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjMzODMxNzQ';
console.log('[DB] Token check:', tokenStart === expectedStart ? '✓ Using NEW token' : '✗ Using OLD token');
console.log('[DB] Token start:', tokenStart);
console.log('[DB] Database URL:', process.env.DATABASE_URL);

// Create the libsql client
const client = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN!,
});

// Create the drizzle instance
export const db = drizzle(client, { schema });

// Export all schema for use in queries
export * from '../drizzle/schema';
