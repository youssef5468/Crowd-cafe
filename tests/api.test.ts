import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { uploadsDirectory } from '../apps/api/src/config';
import { app } from '../apps/api/src/app';
import { crowdItems } from '../packages/shared/src/index';
import { db } from '../apps/api/src/db';

if (process.env.NODE_ENV === 'production' || !process.env.DATABASE_URL?.includes('127.0.0.1'))
  throw new Error('Integration tests require a local development database');
if (process.env.UPLOAD_STORAGE && process.env.UPLOAD_STORAGE !== 'local')
  throw new Error('Integration tests require UPLOAD_STORAGE=local to avoid creating cloud assets');
const owner = request.agent(app).set('X-Galal-CSRF', '1');
const customer = request.agent(app).set('X-Galal-CSRF', '1');
const suffix = randomUUID();
const fixtureItemId = `qa-espresso-${suffix}`;
const fixtureBranchId = `qa-branch-${suffix}`;
const fixtureCategoryId = `qa-category-${suffix}`;
const email = `test-${suffix}@example.test`;
const zoneId = `test-zone-${suffix}`;
const promoId = `test-promo-${suffix}`;
const promoCode = `TEST${suffix.slice(0, 8)}`.toUpperCase();
const orderIds: string[] = [];
const reservationIds: string[] = [];
let token = '';
let orderId = '';
const order = {
  name: 'Integration Test',
  phone: '01000000000',
  fulfillment: 'pickup',
  branchId: fixtureBranchId,
  payment: 'pickup',
  items: [
    {
      itemId: fixtureItemId,
      variantId: 'espresso-1',
      quantity: 2,
      addonIds: [],
      notes: 'test only',
    },
  ],
};
beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes(':54340/'))
    throw new Error('Galal tests require the isolated database on port 54340');
  await db.category.create({
    data: { id: fixtureCategoryId, name_en: 'QA fixture', name_ar: 'اختبار', sort: 99 },
  });
  await db.item.create({
    data: {
      id: fixtureItemId,
      name_en: 'QA Espresso',
      name_ar: 'إسبريسو',
      categoryId: fixtureCategoryId,
      description_en: 'Disposable test fixture',
      description_ar: 'اختبار',
      available: true,
      priceConfirmed: true,
      featured: false,
      image: null,
      temperature: 'hot',
      vegan: false,
      caffeineFree: false,
      variants: [
        { id: 'espresso-1', name_en: 'Single', name_ar: 'سنجل', price: 50 },
        { id: 'espresso-2', name_en: 'Double', name_ar: 'دبل', price: 60 },
      ],
      addons: [],
    },
  });
  await db.branch.create({
    data: {
      id: fixtureBranchId,
      name_en: 'QA branch',
      name_ar: 'فرع اختبار',
      address_en: 'Test location, not a Galal address',
      address_ar: 'عنوان اختبار',
      phone: '+201000000000',
      lat: 30,
      lng: 31,
      open: '10:00',
      close: '03:00',
    },
  });

  await owner
    .post('/api/auth/login')
    .send({ email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD })
    .expect(200);
});
afterAll(async () => {
  await db.order.deleteMany({ where: { id: { in: orderIds } } });
  await db.reservation.deleteMany({ where: { id: { in: reservationIds } } });
  await db.deliveryZone.deleteMany({ where: { id: zoneId } });
  await db.promoCode.deleteMany({ where: { id: promoId } });
  await db.user.deleteMany({ where: { email } });
  await db.item.deleteMany({ where: { id: fixtureItemId } });
  await db.category.deleteMany({ where: { id: fixtureCategoryId } });
  await db.branch.deleteMany({ where: { id: fixtureBranchId } });
  await db.$disconnect();
});
describe('public pages and persisted orders', () => {
  it('serves real PostgreSQL health and the bilingual reference menu', async () => {
    await request(app).get('/api/health').expect(200);
    const response = await request(app).get('/api/menu').expect(200);
    expect(response.body.items).toHaveLength(crowdItems.length + 1);
    expect(response.body.branches.find((b: { id: string }) => b.id === fixtureBranchId).phone).toBe(
      '+201000000000',
    );
    expect(response.body.items.every((i: { name_ar: string }) => i.name_ar)).toBe(true);
  });
  it('rejects unconfirmed prices even when a product is marked available', async () => {
    await db.item.update({ where: { id: fixtureItemId }, data: { priceConfirmed: false } });
    try {
      const response = await request(app).post('/api/orders').send(order);
      if (response.status === 201) orderIds.push(response.body.id);
      expect(response.status).toBe(400);
    } finally {
      await db.item.update({ where: { id: fixtureItemId }, data: { priceConfirmed: true } });
    }
  });
  it('validates phone, options and quantity before storing orders', async () => {
    await request(app)
      .post('/api/orders')
      .send({ ...order, phone: 'invalid' })
      .expect(400);
    await request(app)
      .post('/api/orders')
      .send({ ...order, items: [{ itemId: fixtureItemId, variantId: 'fake', quantity: 1 }] })
      .expect(400);
    await request(app)
      .post('/api/orders')
      .send({ ...order, items: [{ itemId: fixtureItemId, variantId: 'espresso-1', quantity: -2 }] })
      .expect(400);
  });
  it('recomputes totals and protects guest tracking with a random capability', async () => {
    const menu = await request(app).get('/api/menu').expect(200);
    const response = await request(app)
      .post('/api/orders')
      .send({ ...order, total: 1, items: [{ ...order.items[0], unitPrice: 1 }] })
      .expect(201);
    orderId = response.body.id;
    token = response.body.accessToken;
    orderIds.push(orderId);
    expect(response.body.total).toBe(100);
    expect(token).toHaveLength(64);
    expect(response.body.demo).toBe(menu.body.settings.previewMode);
    await request(app).get(`/api/orders/${orderId}`).expect(404);
    await request(app)
      .get(`/api/orders/${orderId}?token=${'0'.repeat(64)}`)
      .expect(404);
    const tracked = await request(app).get(`/api/orders/${orderId}?token=${token}`).expect(200);
    expect(tracked.body.items[0].name_ar).toBe('إسبريسو');
    expect((await db.order.findUnique({ where: { id: orderId } }))?.total).toBe(100);
  });
  it('blocks unauthenticated administration and cross-origin mutations', async () => {
    await request(app).get('/api/admin/overview').expect(401);
    await request(app)
      .post('/api/orders')
      .set('Origin', 'https://other.example')
      .send(order)
      .expect(403);
  });
  it('enforces valid staff order transitions', async () => {
    await owner
      .patch(`/api/admin/orders/${orderId}/status`)
      .send({ status: 'completed' })
      .expect(400);
    for (const status of ['confirmed', 'preparing', 'ready', 'completed']) {
      await owner.patch(`/api/admin/orders/${orderId}/status`).send({ status }).expect(200);
    }
    await owner
      .patch(`/api/admin/orders/${orderId}/status`)
      .send({ status: 'received' })
      .expect(400);
    const tracked = await request(app).get(`/api/orders/${orderId}?token=${token}`).expect(200);
    expect(tracked.body.status).toBe('completed');
  });
  it('validates delivery minimums and calculates real configured zone fees and promos', async () => {
    await owner
      .put(`/api/admin/zones/${zoneId}`)
      .send({
        id: zoneId,
        name_en: 'Test only',
        name_ar: 'اختبار فقط',
        fee: 15,
        minimum: 100,
        active: true,
      })
      .expect(200);
    await owner
      .put(`/api/admin/promos/${promoId}`)
      .send({
        id: promoId,
        code: promoCode,
        percent: 10,
        minimum: 100,
        expiresAt: null,
        active: true,
      })
      .expect(200);
    await request(app)
      .post('/api/orders')
      .send({
        ...order,
        fulfillment: 'delivery',
        payment: 'cash',
        zoneId,
        address: 'A local integration test address',
        items: [{ ...order.items[0], quantity: 1 }],
      })
      .expect(400);
    const response = await request(app)
      .post('/api/orders')
      .send({
        ...order,
        fulfillment: 'delivery',
        payment: 'cash',
        zoneId,
        address: 'A local integration test address',
        promoCode,
      })
      .expect(201);
    orderIds.push(response.body.id);
    expect(response.body.subtotal).toBe(100);
    expect(response.body.fee).toBe(15);
    expect(response.body.discount).toBe(10);
    expect(response.body.total).toBe(105);
  });
});
describe('staff image uploads', () => {
  it('rejects anonymous uploads and corrupt or unsupported files', async () => {
    await request(app).post('/api/admin/uploads').expect(401);
    await owner
      .post('/api/admin/uploads')
      .attach('image', Buffer.from('not an image'), {
        filename: 'photo.png',
        contentType: 'image/png',
      })
      .expect(400);
    await owner
      .post('/api/admin/uploads')
      .attach('image', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), {
        filename: 'photo.svg',
        contentType: 'image/svg+xml',
      })
      .expect(400);
    await owner
      .post('/api/admin/uploads')
      .attach('image', Buffer.alloc(4 * 1024 * 1024 + 1), {
        filename: 'large.png',
        contentType: 'image/png',
      })
      .expect(400);
  });
  it('optimizes a real upload and serves the saved WebP bytes', async () => {
    const png = await sharp({
      create: { width: 2400, height: 1200, channels: 3, background: '#005032' },
    })
      .png()
      .toBuffer();
    const uploaded = await owner
      .post('/api/admin/uploads')
      .attach('image', png, { filename: 'menu.png', contentType: 'image/png' })
      .expect(201);
    expect(uploaded.body.url).toMatch(/^\/uploads\/[a-f\d-]{36}\.webp$/);
    const file = resolve(uploadsDirectory, uploaded.body.url.split('/').at(-1)!);
    try {
      const image = await request(app)
        .get(uploaded.body.url)
        .expect(200)
        .expect('Content-Type', /image\/webp/);
      const metadata = await sharp(image.body).metadata();
      expect(metadata.format).toBe('webp');
      expect(metadata.width).toBe(1600);
      expect(metadata.height).toBe(800);
      expect(image.headers['cache-control']).toContain('immutable');
    } finally {
      await unlink(file);
    }
  });
});

describe('accounts and reservations', () => {
  it('uses httpOnly cookies and prevents customer admin access', async () => {
    const response = await customer
      .post('/api/auth/register')
      .send({ name: 'Test Customer', email, password: `Test!${suffix}` })
      .expect(201);
    expect(response.headers['set-cookie'].join(';')).toContain('HttpOnly');
    expect(response.body.password).toBeUndefined();
    expect(response.body.role).toBe('customer');
    await customer.get('/api/admin/overview').expect(403);
    await customer.post('/api/admin/uploads').expect(403);
    await customer.get('/api/me').expect(200);
  });
  it('links authenticated orders and saves addresses', async () => {
    const response = await customer.post('/api/orders').send(order).expect(201);
    orderIds.push(response.body.id);
    const history = await customer.get('/api/me/orders').expect(200);
    expect(history.body.some((o: { id: string }) => o.id === response.body.id)).toBe(true);
    const saved = await customer
      .patch('/api/me/addresses')
      .send([{ label: 'Test', address: 'A development test address' }])
      .expect(200);
    expect(saved.body.addresses).toHaveLength(1);
  });
  it('accepts future reservations during opening hours and rejects past/out-of-hours requests', async () => {
    const date = new Date(Date.now() + 86401000).toISOString().slice(0, 10);
    const input = {
      name: 'Test Reservation',
      phone: '01000000000',
      branchId: fixtureBranchId,
      date,
      time: '12:00',
      partySize: 2,
      notes: 'test only',
    };
    await request(app)
      .post('/api/reservations')
      .send({ ...input, date: '2020-01-01' })
      .expect(400);
    await request(app)
      .post('/api/reservations')
      .send({ ...input, time: '03:00' })
      .expect(400);
    const response = await request(app).post('/api/reservations').send(input).expect(201);
    reservationIds.push(response.body.id);
    expect(response.body.status).toBe('pending');
    await owner
      .patch(`/api/admin/reservations/${response.body.id}`)
      .send({ status: 'confirmed' })
      .expect(200);
  });
  it('revokes refresh and access sessions on logout', async () => {
    await customer.post('/api/auth/refresh').expect(200);
    await customer.post('/api/auth/logout').expect(200);
    await customer.get('/api/me').expect(401);
    await customer.post('/api/auth/refresh').expect(401);
  });
});
