import { PrismaClient } from '@prisma/client';

// Синглтон Prisma: в dev избегаем множества коннектов из-за hot-reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
