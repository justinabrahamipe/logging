import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client/http";

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/next-js-best-practices

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

// Initialize Prisma Client with Turso adapter using HTTP (no WebSocket)
let prismaInstance: PrismaClient;

if (globalForPrisma.prisma) {
  prismaInstance = globalForPrisma.prisma;
} else {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    const authToken = process.env.DATABASE_AUTH_TOKEN;

    if (!databaseUrl) {
      console.error('DATABASE_URL is not defined in environment variables');
      throw new Error('DATABASE_URL is not defined');
    }

    if (!authToken) {
      console.error('DATABASE_AUTH_TOKEN is not defined in environment variables');
      throw new Error('DATABASE_AUTH_TOKEN is not defined');
    }

    // Create libSQL client for Turso using HTTP protocol (avoids WebSocket/README.md issues)
    const libsql = createClient({
      url: databaseUrl,
      authToken: authToken,
    });

    // Create Prisma adapter
    const adapter = new PrismaLibSQL(libsql);

    // Initialize Prisma Client with adapter
    prismaInstance = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = prismaInstance;
    }
  } catch (error) {
    console.error('Failed to initialize Prisma Client:', error);
    throw error;
  }
}

export const prisma = prismaInstance;
