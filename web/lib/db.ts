import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from '../drizzle/schema';

// Create the libsql client
const client = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN!,
});

// Create the drizzle instance
export const db = drizzle(client, { schema });

// Export all schema for use in queries
export * from '../drizzle/schema';
