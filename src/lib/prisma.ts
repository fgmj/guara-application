import { PrismaClient } from "@prisma/client";

// Reaproveita a conexão entre hot reloads em desenvolvimento
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
