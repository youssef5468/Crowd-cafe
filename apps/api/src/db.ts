import './config.js';
import { PrismaClient } from '@prisma/client';
const cached = globalThis as unknown as { galalDatabase?: PrismaClient };
const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
if (process.env.VERCEL && url) {
  if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', '2');
  if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', '20');
}
export const db =
  cached.galalDatabase ??
  new PrismaClient(url ? { datasources: { db: { url: url.href } } } : undefined);
cached.galalDatabase = db;
