import { PrismaClient } from "@prisma/client";

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/next-js-best-practices

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Clean the DATABASE_URL by removing channel_binding parameter
// This is needed because Neon's Vercel integration adds it, but Prisma doesn't support it
const getDatabaseUrl = () => {
  const url = process.env.DATABASE_URL;
  if (!url) return url;

  // Remove channel_binding parameter if present
  return url.replace(/[&?]channel_binding=[^&]*/g, '');
};

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: getDatabaseUrl(),
    },
  },
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
