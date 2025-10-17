import { PrismaClient } from "@prisma/client";

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/next-js-best-practices

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

// Clean the DATABASE_URL by removing channel_binding parameter
// This is needed because Neon's Vercel integration adds it, but Prisma doesn't support it
const getDatabaseUrl = () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not defined in environment variables');
    throw new Error('DATABASE_URL is not defined');
  }

  // Remove channel_binding parameter if present
  return url.replace(/[&?]channel_binding=[^&]*/g, '');
};

// Initialize Prisma Client
let prismaInstance: PrismaClient;

if (globalForPrisma.prisma) {
  prismaInstance = globalForPrisma.prisma;
} else {
  try {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      datasources: {
        db: {
          url: getDatabaseUrl(),
        },
      },
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
