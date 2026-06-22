import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/salesgenius?schema=public';

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);

// Initialise Prisma Client using the driver adapter in Prisma 7
const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export default prisma;
export { prisma };
