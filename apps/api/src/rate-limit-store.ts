import { createHmac } from 'node:crypto';
import type { Store, Options } from 'express-rate-limit';
import { db } from './db.js';

/** Shared atomic counters; no raw IP addresses are stored. */
export class PostgresRateLimitStore implements Store {
  windowMs = 60000;
  constructor(private namespace: string) {}
  init(options: Options) {
    this.windowMs = options.windowMs;
  }
  private key(value: string) {
    return `${this.namespace}:${createHmac('sha256', process.env.JWT_SECRET!).update(value).digest('hex')}`;
  }
  async increment(value: string) {
    const key = this.key(value);
    const [result] = await db.$queryRaw<{ hits: number; resetAt: Date }[]>`
      INSERT INTO rate_limits (key, hits, "resetAt")
      VALUES (${key}, 1, NOW() + ${this.windowMs} * INTERVAL '1 millisecond')
      ON CONFLICT (key) DO UPDATE SET
        hits = CASE WHEN rate_limits."resetAt" <= NOW() THEN 1 ELSE rate_limits.hits + 1 END,
        "resetAt" = CASE WHEN rate_limits."resetAt" <= NOW()
          THEN NOW() + ${this.windowMs} * INTERVAL '1 millisecond' ELSE rate_limits."resetAt" END
      RETURNING hits, "resetAt"`;
    if (Math.random() < 0.01)
      await db.$executeRaw`
      DELETE FROM rate_limits WHERE key IN (SELECT key FROM rate_limits WHERE "resetAt" < NOW() LIMIT 500)`;
    return { totalHits: result.hits, resetTime: result.resetAt };
  }
  async decrement(value: string) {
    await db.$executeRaw`UPDATE rate_limits SET hits = GREATEST(hits - 1, 0) WHERE key = ${this.key(value)}`;
  }
  async resetKey(value: string) {
    await db.rateLimit.deleteMany({ where: { key: this.key(value) } });
  }
}
