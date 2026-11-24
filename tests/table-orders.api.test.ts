import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { app } from '../apps/api/src/app';
import { db } from '../apps/api/src/db';

if (process.env.NODE_ENV === 'production' || !process.env.DATABASE_URL?.includes('127.0.0.1'))
  throw new Error('Integration tests require a local development database');
const owner = request.agent(app).set('X-Galal-CSRF', '1');
const suffix = randomUUID();
const itemId = `qa-dinein-${suffix}`;
const categoryId = `qa-dinein-category-${suffix}`;
const branchId = `qa-dinein-branch-${suffix}`;
const orderIds: string[] = [];
const line = (quantity: number, person = '') => ({
  itemId,
  variantId: 'v1',
  quantity,
  addonIds: [],
  notes: '',
  person,
});
const place = async (overrides: Record<string, unknown> = {}) => {
  const response = await request(app)
    .post('/api/table-orders')
    .send({ tableNumber: '7', branchId, items: [line(2, 'Mona'), line(1, 'Omar')], ...overrides });
  if (response.status === 201) orderIds.push(response.body.id);
  return response;
};

beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes(':54340/'))
    throw new Error('Galal tests require the isolated database on port 54340');
  await db.category.create({
    data: { id: categoryId, name_en: 'QA dine-in', name_ar: 'اختبار', sort: 98 },
  });
  await db.item.create({
    data: {
      id: itemId,
      name_en: 'QA Dine-in Coffee',
      name_ar: 'قهوة اختبار',
      categoryId,
      description_en: 'Disposable test fixture',
      description_ar: 'اختبار',
      available: true,
      priceConfirmed: true,
      featured: false,
      image: null,
      temperature: 'hot',
      vegan: false,
      caffeineFree: false,
      variants: [{ id: 'v1', name_en: 'Regular', name_ar: 'عادي', price: 50 }],
      addons: [],
    },
  });
  await db.branch.create({
    data: {
      id: branchId,
      name_en: 'QA dine-in branch',
      name_ar: 'فرع اختبار',
      address_en: 'Test location',
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
  await db.item.deleteMany({ where: { id: itemId } });
  await db.category.deleteMany({ where: { id: categoryId } });
  await db.branch.deleteMany({ where: { id: branchId } });
  await db.$disconnect();
});

describe('dine-in order creation', () => {
  it('creates an unpaid order with a server-priced total, a short code and an expiry', async () => {
    const response = await place();
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('awaiting_payment');
    expect(response.body.fulfillment).toBe('dine_in');
    expect(response.body.payment).toBe('cash');
    expect(response.body.tableNumber).toBe('7');
    expect(response.body.total).toBe(150);
    expect(response.body.pickupCode).toMatch(/^[A-HJ-KM-NP-Z2-9]{6}$/);
    const minutes = (new Date(response.body.codeExpiresAt).getTime() - Date.now()) / 60000;
    expect(minutes).toBeGreaterThan(19);
    expect(minutes).toBeLessThanOrEqual(20);
    expect(response.body.items.map((i: { person: string }) => i.person).sort()).toEqual([
      'Mona',
      'Omar',
    ]);
  });
  it('rejects invalid tables, empty orders, unknown options and unavailable items', async () => {
    await place({ tableNumber: 'not valid!' }).then((r) => expect(r.status).toBe(400));
    await place({ items: [] }).then((r) => expect(r.status).toBe(400));
    await place({ items: [{ ...line(1), variantId: 'fake' }] }).then((r) =>
      expect(r.status).toBe(400),
    );
    await db.item.update({ where: { id: itemId }, data: { available: false } });
    try {
      await place().then((r) => expect(r.status).toBe(400));
    } finally {
      await db.item.update({ where: { id: itemId }, data: { available: true } });
    }
  });
  it('lets the customer follow the order only with the private token', async () => {
    const created = await place();
    await request(app)
      .get(`/api/orders/${created.body.id}?token=${created.body.accessToken}`)
      .expect(200);
    await request(app)
      .get(`/api/orders/${created.body.id}?token=${'0'.repeat(64)}`)
      .expect(404);
  });
});

describe('cashier and barista flow', () => {
  it('keeps the cashier endpoints behind a staff login', async () => {
    const created = await place();
    await request(app).get(`/api/admin/table-orders/${created.body.pickupCode}`).expect(401);
    await request(app).post(`/api/admin/table-orders/${created.body.pickupCode}/pay`).expect(401);
    await request(app).get('/api/admin/kitchen').expect(401);
  });
  it('hides unpaid orders, then releases them to the barista once the cashier takes payment', async () => {
    const created = await place();
    const code = created.body.pickupCode as string;
    const before = await owner.get('/api/admin/kitchen').expect(200);
    expect(before.body.some((o: { id: string }) => o.id === created.body.id)).toBe(false);
    const overview = await owner.get('/api/admin/overview').expect(200);
    expect(overview.body.orders.some((o: { id: string }) => o.id === created.body.id)).toBe(false);

    const found = await owner.get(`/api/admin/table-orders/${code.toLowerCase()}`).expect(200);
    expect(found.body.total).toBe(150);
    const paid = await owner.post(`/api/admin/table-orders/${code}/pay`).expect(200);
    expect(paid.body.status).toBe('confirmed');
    expect(paid.body.paidAt).toBeTruthy();

    const after = await owner.get('/api/admin/kitchen').expect(200);
    expect(after.body.some((o: { id: string }) => o.id === created.body.id)).toBe(true);
    const tracked = await request(app)
      .get(`/api/orders/${created.body.id}?token=${created.body.accessToken}`)
      .expect(200);
    expect(tracked.body.status).toBe('confirmed');
  });
  it('accepts each code once', async () => {
    const created = await place();
    const code = created.body.pickupCode as string;
    await owner.post(`/api/admin/table-orders/${code}/pay`).expect(200);
    await owner.post(`/api/admin/table-orders/${code}/pay`).expect(409);
    await owner.get(`/api/admin/table-orders/${code}`).expect(409);
  });
  it('refuses expired, unknown and malformed codes', async () => {
    const created = await place();
    const code = created.body.pickupCode as string;
    await db.order.update({
      where: { id: created.body.id },
      data: { codeExpiresAt: new Date(Date.now() - 1000) },
    });
    await owner.get(`/api/admin/table-orders/${code}`).expect(410);
    await owner.post(`/api/admin/table-orders/${code}/pay`).expect(410);
    expect((await db.order.findUnique({ where: { id: created.body.id } }))?.status).toBe(
      'awaiting_payment',
    );
    await owner.get('/api/admin/table-orders/ZZZZZZ').expect(404);
    await owner.get('/api/admin/table-orders/bad').expect(400);
  });
  it('lets the barista move a paid order through the existing statuses', async () => {
    const created = await place();
    await owner.post(`/api/admin/table-orders/${created.body.pickupCode}/pay`).expect(200);
    for (const status of ['preparing', 'ready', 'completed'])
      await owner.patch(`/api/admin/orders/${created.body.id}/status`).send({ status }).expect(200);
  });
  it('never offers out-for-delivery for a dine-in order', async () => {
    const created = await place();
    await owner.post(`/api/admin/table-orders/${created.body.pickupCode}/pay`).expect(200);
    await owner
      .patch(`/api/admin/orders/${created.body.id}/status`)
      .send({ status: 'out_for_delivery' })
      .expect(400);
  });
});
