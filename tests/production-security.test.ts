import 'dotenv/config';
import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { runtimeConfig } from '../apps/api/src/runtime-config';
import { PostgresRateLimitStore } from '../apps/api/src/rate-limit-store';
import { db } from '../apps/api/src/db';
import { app } from '../apps/api/src/app';
import { registerSchema } from '@galal/shared';

const production = {
  NODE_ENV: 'production',
  PUBLIC_URL: 'https://cafe.example',
  WEB_ORIGIN: 'https://cafe.example',
  JWT_SECRET: 'a-random-looking-production-secret-of-48-characters',
  DATABASE_URL: 'postgresql://user:pass@db.example/cafe?sslmode=require',
  UPLOAD_STORAGE: 'cloudinary',
  VERCEL: '1',
};
describe('production safeguards', () => {
  it('allows Cloudinary image delivery under the production security policy', async () => {
    const response = await request(app).get('/api/health').expect(200);
    expect(response.headers['content-security-policy']).toContain(
      "img-src 'self' data: https://res.cloudinary.com",
    );
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
  it('requires HTTPS origins, a remote TLS database and cloud storage', () => {
    expect(runtimeConfig(production).production).toBe(true);
    expect(() => runtimeConfig({ ...production, WEB_ORIGIN: 'http://cafe.example' })).toThrow(
      'HTTPS',
    );
    expect(() =>
      runtimeConfig({
        ...production,
        DATABASE_URL: 'postgresql://u:p@127.0.0.1/cafe?sslmode=require',
      }),
    ).toThrow('hosted');
    expect(() =>
      runtimeConfig({ ...production, DATABASE_URL: 'postgresql://u:p@db.example/cafe' }),
    ).toThrow('SSL');
    expect(() => runtimeConfig({ ...production, UPLOAD_STORAGE: 'local' })).toThrow('cloudinary');
    expect(() =>
      runtimeConfig({ ...production, JWT_SECRET: 'replace-with-at-least-32-random-characters' }),
    ).toThrow('JWT_SECRET');
  });
  it('permits only the explicit local production harness and exact Vercel preview origin', () => {
    expect(
      runtimeConfig({
        ...production,
        VERCEL: undefined,
        LOCAL_PRODUCTION_PREVIEW: '1',
        PUBLIC_URL: 'http://127.0.0.1:4011',
        WEB_ORIGIN: 'http://127.0.0.1:4011',
      }).production,
    ).toBe(true);
    expect(() =>
      runtimeConfig({
        ...production,
        LOCAL_PRODUCTION_PREVIEW: '1',
        PUBLIC_URL: 'http://127.0.0.1:4011',
      }),
    ).toThrow();
    expect(
      runtimeConfig({ ...production, VERCEL_URL: 'preview-123.vercel.app' }).origins,
    ).toContain('https://preview-123.vercel.app');
  });
  it('rejects cross-site requests, hostile referrers and authenticated originless writes', async () => {
    await request(app).post('/api/auth/logout').set('Sec-Fetch-Site', 'cross-site').expect(403);
    await request(app)
      .post('/api/auth/logout')
      .set('Referer', 'https://hostile.example/')
      .expect(403);
    await request(app)
      .post('/api/auth/logout')
      .set('Cookie', 'galal_access_token=invalid')
      .expect(403);
    await request(app)
      .post('/api/auth/logout')
      .set('Cookie', 'galal_access_token=invalid')
      .set('X-Galal-CSRF', '1')
      .expect(200);
  });
  it('prevents bcrypt truncating new passwords, including multibyte text', () => {
    const base = { name: 'A Person', email: 'person@example.test' };
    expect(registerSchema.safeParse({ ...base, password: 'a'.repeat(73) }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: 'أ'.repeat(37) }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: 'a'.repeat(72) }).success).toBe(true);
  });
  it('shares counters atomically across instances and resets expired windows', async () => {
    if (!process.env.DATABASE_URL?.includes('127.0.0.1'))
      throw new Error('Local test database required');
    const namespace = `security-test-${randomUUID()}`;
    const a = new PostgresRateLimitStore(namespace);
    const b = new PostgresRateLimitStore(namespace);
    try {
      const hits = await Promise.all(
        Array.from({ length: 20 }, (_, i) => (i % 2 ? a : b).increment('127.0.0.7')),
      );
      expect(hits.map((h) => h.totalHits).sort((x, y) => x - y)).toEqual(
        Array.from({ length: 20 }, (_, i) => i + 1),
      );
      const stored = await db.rateLimit.findFirstOrThrow({
        where: { key: { startsWith: namespace } },
      });
      expect(stored.key).not.toContain('127.0.0.7');
      await db.rateLimit.update({ where: { key: stored.key }, data: { resetAt: new Date(0) } });
      expect((await a.increment('127.0.0.7')).totalHits).toBe(1);
    } finally {
      await db.rateLimit.deleteMany({ where: { key: { startsWith: namespace } } });
    }
  });
});
