import 'dotenv/config';
import express, {
  type Request,
  type Response,
  type NextFunction,
  type RequestHandler,
} from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import multer from 'multer';
import sharp from 'sharp';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { z, ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import {
  branchSchema,
  categorySchema,
  itemSchema,
  zoneSchema,
  promoSchema,
  settingsSchema,
  defaultSettings,
  orderSchema,
  tableOrderSchema,
  parsePickupCode,
  PICKUP_CODE_TTL_MINUTES,
  reservationSchema,
  loginSchema,
  registerSchema,
  addressSchema,
  statusSchema,
  reservationStatusSchema,
  cairoDate,
  type OrderStatus,
} from '@galal/shared';
import { db } from './db.js';
import { newPickupCode } from './pickup-code.js';
import { uploadsDirectory, webDirectory } from './config.js';
import { storeImage } from './image-storage.js';
import { PostgresRateLimitStore } from './rate-limit-store.js';
import { runtimeConfig } from './runtime-config.js';

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
const jwtSecret: string = secret;
const { production, origins, publicUrl } = runtimeConfig(process.env);
const identity = z.object({
  sub: z.string(),
  version: z.number(),
  type: z.enum(['access', 'refresh']),
});
type Identity = z.infer<typeof identity>;
type AuthRequest = Request & {
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    sessionVersion: number;
    addresses: Prisma.JsonValue;
  };
};
class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const wrap =
  (fn: (req: AuthRequest, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
const requireAuth = wrap(async (req, _res, next) => {
  const payload = readToken(req.cookies.galal_access_token, 'access');
  if (!payload) throw new ApiError(401, 'Please sign in');
  const user = await db.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.sessionVersion !== payload.version) throw new ApiError(401, 'Session expired');
  req.user = user;
  next();
});
const staff: RequestHandler = (req, _res, next) => {
  const user = (req as AuthRequest).user;
  if (!user || !['staff', 'owner'].includes(user.role))
    return next(new ApiError(403, 'Staff access required'));
  next();
};
const owner: RequestHandler = (req, _res, next) => {
  if ((req as AuthRequest).user?.role !== 'owner')
    return next(new ApiError(403, 'Owner access required'));
  next();
};
function readToken(token: unknown, type: Identity['type']): Identity | null {
  try {
    const parsed = identity.parse(
      jwt.verify(z.string().parse(token), jwtSecret, { algorithms: ['HS256'] }),
    );
    return parsed.type === type ? parsed : null;
  } catch {
    return null;
  }
}
function setCookies(res: Response, user: { id: string; sessionVersion: number }) {
  for (const type of ['access', 'refresh'] as const)
    res.cookie(
      `galal_${type}_token`,
      jwt.sign({ sub: user.id, version: user.sessionVersion, type }, jwtSecret, {
        expiresIn: type === 'access' ? '15m' : '7d',
      }),
      {
        httpOnly: true,
        secure: production,
        sameSite: 'lax',
        maxAge: type === 'access' ? 900000 : 604800000,
        path: '/api',
      },
    );
}
function safeUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  addresses: Prisma.JsonValue;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    addresses: user.addresses,
  };
}
async function settings() {
  const record = await db.setting.findUnique({ where: { id: 'site' } });
  return settingsSchema.parse(record?.data ?? defaultSettings);
}
const idParam = (req: Request) => z.string().min(1).max(150).parse(req.params.id);
const authLimiter = rateLimit({
  ...(production ? { store: new PostgresRateLimitStore('auth') } : {}),
  windowMs: 900000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again later.' },
});
const submitLimiter = rateLimit({
  ...(production ? { store: new PostgresRateLimitStore('submit') } : {}),
  windowMs: 60000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Please wait a moment before submitting again.' },
});

export const app = express();
app.disable('x-powered-by');
app.use(compression());
app.set('trust proxy', production ? 1 : false);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
        frameSrc: ["'self'", 'https://www.google.com', 'https://maps.google.com'],
        upgradeInsecureRequests: production ? [] : null,
      },
    },
  }),
);
app.use(
  cors({
    origin: (origin, callback) => callback(null, !origin || origins.includes(origin)),
    credentials: true,
  }),
);
app.use(express.json({ limit: '128kb' }));
app.use(cookieParser());
app.use(
  '/api',
  rateLimit({
    ...(production ? { store: new PostgresRateLimitStore('api') } : {}),
    windowMs: 60000,
    limit: 600,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
);
app.use('/api', (req, _res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    if (req.get('Sec-Fetch-Site') === 'cross-site')
      return next(new ApiError(403, 'Cross-site requests are not allowed'));
    const origin = req.get('Origin');
    let referrerOrigin: string | undefined;
    try {
      if (req.get('Referer')) referrerOrigin = new URL(req.get('Referer')!).origin;
    } catch {
      return next(new ApiError(403, 'Invalid request origin'));
    }
    if (!origin && referrerOrigin && !origins.includes(referrerOrigin))
      return next(new ApiError(403, 'Origin not allowed'));
    if (
      (req.cookies.galal_access_token || req.cookies.galal_refresh_token) &&
      !origin &&
      !referrerOrigin &&
      req.get('X-Galal-CSRF') !== '1'
    )
      return next(new ApiError(403, 'Missing request origin or CSRF header'));
  }
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
    req.headers.origin &&
    !origins.includes(req.headers.origin)
  )
    return next(new ApiError(403, 'Origin not allowed'));
  next();
});
app.use(
  '/uploads',
  express.static(uploadsDirectory, {
    dotfiles: 'deny',
    immutable: true,
    maxAge: '1y',
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'");
    },
  }),
);
const api = express.Router();
app.use('/api', api);
api.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
api.get(
  '/health',
  wrap(async (_req, res) => {
    await db.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'postgresql' });
  }),
);
api.get(
  '/menu',
  wrap(async (_req, res) => {
    const [items, categories, config, branches] = await Promise.all([
      db.item.findMany({ orderBy: { id: 'asc' } }),
      db.category.findMany({ orderBy: { sort: 'asc' } }),
      settings(),
      db.branch.findMany(),
    ]);
    res.json({ items, categories, settings: config, branches });
  }),
);
api.get(
  '/menu/:id',
  wrap(async (req, res) => {
    const item = await db.item.findUnique({ where: { id: idParam(req) } });
    if (!item) throw new ApiError(404, 'Item not found');
    res.json(item);
  }),
);
api.get(
  '/branches',
  wrap(async (_req, res) => res.json(await db.branch.findMany())),
);
api.get(
  '/delivery-zones',
  wrap(async (_req, res) => res.json(await db.deliveryZone.findMany({ where: { active: true } }))),
);
api.get(
  '/events',
  wrap(async (_req, res) =>
    res.json(
      await db.event.findMany({ where: { date: { gte: cairoDate() } }, orderBy: { date: 'asc' } }),
    ),
  ),
);
api.get(
  '/reviews',
  wrap(async (_req, res) =>
    res.json(
      await db.review.findMany({
        where: { approved: true },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ),
  ),
);
api.post(
  '/auth/register',
  authLimiter,
  wrap(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const user = await db.user.create({
      data: { ...input, password: await bcrypt.hash(input.password, 12) },
    });
    setCookies(res, user);
    res.status(201).json(safeUser(user));
  }),
);
api.post(
  '/auth/login',
  authLimiter,
  wrap(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await db.user.findUnique({ where: { email: input.email } });
    const hash = user?.password ?? '$2b$12$TqozpjFR9KwARnQDsVewg.pziKxhOrWpXKTqOT8vvGt8QLuFc5YcK';
    const valid = await bcrypt.compare(input.password, hash);
    if (!user || !valid) throw new ApiError(401, 'Invalid email or password');
    setCookies(res, user);
    res.json(safeUser(user));
  }),
);
api.post(
  '/auth/refresh',
  authLimiter,
  wrap(async (req, res) => {
    const payload = readToken(req.cookies.galal_refresh_token, 'refresh');
    if (!payload) throw new ApiError(401, 'Please sign in again');
    const user = await db.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.sessionVersion !== payload.version)
      throw new ApiError(401, 'Session expired');
    setCookies(res, user);
    res.json(safeUser(user));
  }),
);
api.post(
  '/auth/logout',
  wrap(async (req, res) => {
    const payload = readToken(req.cookies.galal_refresh_token, 'refresh');
    if (payload)
      await db.user.updateMany({
        where: { id: payload.sub, sessionVersion: payload.version },
        data: { sessionVersion: { increment: 1 } },
      });
    for (const name of ['galal_access_token', 'galal_refresh_token'])
      res.clearCookie(name, { path: '/api', httpOnly: true, secure: production, sameSite: 'lax' });
    res.json({ message: 'Signed out' });
  }),
);
api.get(
  '/me',
  requireAuth,
  wrap(async (req, res) => res.json(safeUser(req.user!))),
);
api.patch(
  '/me/addresses',
  requireAuth,
  wrap(async (req, res) => {
    const addresses = z.array(addressSchema).max(10).parse(req.body);
    const user = await db.user.update({ where: { id: req.user!.id }, data: { addresses } });
    res.json(safeUser(user));
  }),
);
api.get(
  '/me/orders',
  requireAuth,
  wrap(async (req, res) =>
    res.json(
      await db.order.findMany({
        where: { userId: req.user!.id },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ),
  ),
);

async function validatePromo(code: string, subtotal: number) {
  const promo = await db.promoCode.findUnique({ where: { code: code.toUpperCase() } });
  if (
    !promo ||
    !promo.active ||
    (promo.expiresAt && promo.expiresAt < new Date()) ||
    subtotal < promo.minimum
  )
    throw new ApiError(400, 'Promo code is invalid, expired, or its minimum is not met');
  return Math.round((subtotal * promo.percent) / 100);
}
api.post(
  '/promo/validate',
  submitLimiter,
  wrap(async (req, res) => {
    const input = z
      .object({ code: z.string().min(1).max(30), subtotal: z.number().int().min(0).max(1000000) })
      .parse(req.body);
    res.json({ discount: await validatePromo(input.code, input.subtotal) });
  }),
);
async function priceLines(lines: z.infer<typeof orderSchema>['items']) {
  const records = await db.item.findMany({
    where: { id: { in: lines.map((line) => line.itemId) } },
  });
  return lines.map((line) => {
    const record = records.find((item) => item.id === line.itemId);
    if (!record || !record.available || !record.priceConfirmed)
      throw new ApiError(400, 'An item is unavailable');
    const item = itemSchema.parse(record);
    const variant = item.variants.find((v) => v.id === line.variantId);
    if (!variant) throw new ApiError(400, 'Invalid item option');
    const addonIds = [...new Set(line.addonIds)];
    const addons = addonIds.map((id) => {
      const addon = item.addons.find((v) => v.id === id);
      if (!addon) throw new ApiError(400, 'Invalid add-on');
      return addon;
    });
    return {
      itemId: item.id,
      name_en: item.name_en,
      name_ar: item.name_ar,
      variant_en: variant.name_en,
      variant_ar: variant.name_ar,
      quantity: line.quantity,
      unitPrice: variant.price + addons.reduce((sum, a) => sum + a.price, 0),
      notes: line.notes,
      addons: addons.map((a) => `${a.name_en} / ${a.name_ar}`),
    };
  });
}
api.post(
  '/orders',
  submitLimiter,
  wrap(async (req, res) => {
    const input = orderSchema.parse(req.body);
    const config = await settings();
    if (!(await db.branch.findUnique({ where: { id: input.branchId } })))
      throw new ApiError(400, 'Choose a valid branch');
    const items = await priceLines(input.items);
    const subtotal = items.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
    let fee = 0;
    if (input.fulfillment === 'delivery') {
      const zone = await db.deliveryZone.findUnique({ where: { id: input.zoneId } });
      if (!zone?.active) throw new ApiError(400, 'Delivery is unavailable in this zone');
      if (subtotal < zone.minimum) throw new ApiError(400, `Minimum order is EGP ${zone.minimum}`);
      fee = zone.fee;
    }
    const discount = input.promoCode ? await validatePromo(input.promoCode, subtotal) : 0;
    const payload = readToken(req.cookies.galal_access_token, 'access');
    const user = payload
      ? await db.user.findFirst({ where: { id: payload.sub, sessionVersion: payload.version } })
      : null;
    const { items: _lines, ...fields } = input;
    const order = await db.order.create({
      data: {
        ...fields,
        userId: user?.id,
        accessToken: randomBytes(32).toString('hex'),
        subtotal,
        fee,
        discount,
        total: subtotal + fee - discount,
        demo: config.previewMode,
        items: { create: items },
      },
      include: { items: true },
    });
    res.status(201).json(order);
  }),
);
// Dine-in order: created at the table, held as "awaiting_payment" until the cashier scans the code.
api.post(
  '/table-orders',
  submitLimiter,
  wrap(async (req, res) => {
    const input = tableOrderSchema.parse(req.body);
    const config = await settings();
    const branch = input.branchId
      ? await db.branch.findUnique({ where: { id: input.branchId } })
      : await db.branch.findFirst({ orderBy: { id: 'asc' } });
    if (!branch) throw new ApiError(400, 'Choose a valid branch');
    const priced = await priceLines(input.items);
    const items = priced.map((line, index) => ({ ...line, person: input.items[index].person }));
    const subtotal = items.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
    for (let attempt = 0; ; attempt += 1) {
      try {
        const order = await db.order.create({
          data: {
            branchId: branch.id,
            name: input.name || `Table ${input.tableNumber}`,
            phone: '',
            fulfillment: 'dine_in',
            address: '',
            notes: input.notes,
            payment: 'cash',
            tableNumber: input.tableNumber,
            pickupCode: newPickupCode(),
            codeExpiresAt: new Date(Date.now() + PICKUP_CODE_TTL_MINUTES * 60000),
            accessToken: randomBytes(32).toString('hex'),
            subtotal,
            fee: 0,
            discount: 0,
            total: subtotal,
            status: 'awaiting_payment',
            demo: config.previewMode,
            items: { create: items },
          },
          include: { items: true },
        });
        return void res.status(201).json(order);
      } catch (error) {
        // The short code is unique; on the rare collision draw a new one.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          attempt < 4
        )
          continue;
        throw error;
      }
    }
  }),
);
api.get(
  '/orders/:id',
  wrap(async (req, res) => {
    const token = z.string().length(64).safeParse(req.query.token);
    if (!token.success) throw new ApiError(404, 'Order not found');
    const order = await db.order.findFirst({
      where: { id: idParam(req), accessToken: token.data },
      include: { items: true },
    });
    if (!order) throw new ApiError(404, 'Order not found');
    res.setHeader('Cache-Control', 'no-store');
    res.json(order);
  }),
);
api.post(
  '/reservations',
  submitLimiter,
  wrap(async (req, res) => {
    const input = reservationSchema.parse(req.body);
    const branch = await db.branch.findUnique({ where: { id: input.branchId } });
    if (!branch || branch.lat === null || branch.lng === null)
      throw new ApiError(400, 'Choose a branch with a confirmed location for table reservations');
    const today = cairoDate();
    if (
      input.date < today ||
      input.date > new Date(Date.now() + 90 * 86401000).toISOString().slice(0, 10)
    )
      throw new ApiError(400, 'Choose a date within the next 90 days');
    const config = await settings();
    const open = config.ramadanMode && branch.ramadanOpen ? branch.ramadanOpen : branch.open;
    const close = config.ramadanMode && branch.ramadanClose ? branch.ramadanClose : branch.close;
    const available =
      open === close ||
      (open < close
        ? input.time >= open && input.time < close
        : input.time >= open || input.time < close);
    if (!available) throw new ApiError(400, 'Please choose a time within opening hours');
    const clock = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Cairo',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date());
    if (input.date === today && input.time <= clock)
      throw new ApiError(400, 'Choose a future reservation time');
    const reservation = await db.reservation.create({
      data: { ...input, demo: config.previewMode },
    });
    res.status(201).json(reservation);
  }),
);

api.use('/admin', requireAuth, staff);
api.get(
  '/admin/overview',
  wrap(async (_req, res) => {
    const [orders, reservations, reviews, contacts, subscriberCount, zones, promos, events] =
      await Promise.all([
        db.order.findMany({
          where: { status: { not: 'awaiting_payment' } },
          include: { items: true },
          orderBy: { createdAt: 'desc' },
          take: 200,
        }),
        db.reservation.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
        db.review.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
        db.contact.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
        db.subscriber.count(),
        db.deliveryZone.findMany(),
        db.promoCode.findMany(),
        db.event.findMany(),
      ]);
    res.json({ orders, reservations, reviews, contacts, subscriberCount, zones, promos, events });
  }),
);
api.get(
  '/admin/stats',
  wrap(async (_req, res) => {
    const orders = await db.order.findMany({
      where: { status: 'completed', demo: false },
      include: { items: true },
    });
    const days: Record<string, { orders: number; revenue: number }> = {};
    const top: Record<string, { name: string; quantity: number }> = {};
    for (const order of orders) {
      const date = cairoDate(order.createdAt);
      days[date] ??= { orders: 0, revenue: 0 };
      days[date].orders++;
      days[date].revenue += order.total;
      for (const item of order.items) {
        top[item.itemId] ??= { name: item.name_en, quantity: 0 };
        top[item.itemId].quantity += item.quantity;
      }
    }
    res.json({
      revenue: orders.reduce((s, o) => s + o.total, 0),
      orders: orders.length,
      days,
      topItems: Object.values(top)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10),
    });
  }),
);
const codeParam = (req: Request) => {
  const code = parsePickupCode(String(req.params.code));
  if (!code) throw new ApiError(400, 'Invalid order code');
  return code;
};
// Cashier: look the order up by its short code.
api.get(
  '/admin/table-orders/:code',
  wrap(async (req, res) => {
    const order = await db.order.findUnique({
      where: { pickupCode: codeParam(req) },
      include: { items: true },
    });
    if (!order) throw new ApiError(404, 'Order not found');
    res.setHeader('Cache-Control', 'no-store');
    if (order.status !== 'awaiting_payment')
      throw new ApiError(409, 'This order was already handled');
    if (!order.codeExpiresAt || order.codeExpiresAt.getTime() <= Date.now())
      throw new ApiError(410, 'This code has expired');
    res.json(order);
  }),
);
// Cashier: payment taken in cash. One atomic update, so a code can only be used once and never after it expires.
api.post(
  '/admin/table-orders/:code/pay',
  wrap(async (req, res) => {
    const code = codeParam(req);
    const paid = await db.order.updateMany({
      where: { pickupCode: code, status: 'awaiting_payment', codeExpiresAt: { gt: new Date() } },
      data: { status: 'confirmed', paidAt: new Date() },
    });
    if (paid.count !== 1) {
      const order = await db.order.findUnique({ where: { pickupCode: code } });
      if (!order) throw new ApiError(404, 'Order not found');
      if (order.status !== 'awaiting_payment')
        throw new ApiError(409, 'This order was already handled');
      throw new ApiError(410, 'This code has expired');
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json(await db.order.findUnique({ where: { pickupCode: code }, include: { items: true } }));
  }),
);
// Barista screen: paid orders that still need work, oldest first.
api.get(
  '/admin/kitchen',
  wrap(async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(
      await db.order.findMany({
        where: { status: { in: ['confirmed', 'preparing', 'ready'] } },
        include: { items: true },
        orderBy: { createdAt: 'asc' },
        take: 100,
      }),
    );
  }),
);
const transitions: Record<OrderStatus, OrderStatus[]> = {
  awaiting_payment: ['cancelled'],
  received: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['completed', 'out_for_delivery', 'cancelled'],
  out_for_delivery: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};
api.patch(
  '/admin/orders/:id/status',
  wrap(async (req, res) => {
    const { status } = z.object({ status: statusSchema }).parse(req.body);
    const order = await db.order.findUnique({ where: { id: idParam(req) } });
    if (!order) throw new ApiError(404, 'Order not found');
    if (
      !transitions[statusSchema.parse(order.status)].includes(status) ||
      (order.fulfillment !== 'delivery' && status === 'out_for_delivery')
    )
      throw new ApiError(400, 'Invalid status transition');
    const updated = await db.order.updateMany({
      where: { id: order.id, status: order.status },
      data: { status },
    });
    if (updated.count !== 1) throw new ApiError(409, 'Order changed; refresh and try again');
    res.json(await db.order.findUnique({ where: { id: order.id }, include: { items: true } }));
  }),
);
api.patch(
  '/admin/reservations/:id',
  wrap(async (req, res) => {
    const { status } = z.object({ status: reservationStatusSchema }).parse(req.body);
    res.json(await db.reservation.update({ where: { id: idParam(req) }, data: { status } }));
  }),
);
api.patch(
  '/admin/reviews/:id',
  wrap(async (req, res) => {
    const { approved } = z.object({ approved: z.boolean() }).parse(req.body);
    res.json(await db.review.update({ where: { id: idParam(req) }, data: { approved } }));
  }),
);
const eventSchema = z.object({
  id: z.string().min(1).max(100),
  name_en: z.string().min(1).max(150),
  name_ar: z.string().min(1).max(150),
  description_en: z.string().max(2000),
  description_ar: z.string().max(2000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
const entities = ['items', 'categories', 'branches', 'zones', 'promos', 'events'] as const;
const entitySchema = z.enum(entities);
api.put(
  '/admin/:entity/:id',
  wrap(async (req, res) => {
    const entity = entitySchema.parse(req.params.entity);
    if (entity !== 'items' && req.user!.role !== 'owner')
      throw new ApiError(403, 'Owner access required');
    const id = idParam(req);
    if (req.body.id !== id) throw new ApiError(400, 'Record ID does not match URL');
    let result: unknown;
    switch (entity) {
      case 'items': {
        const data = itemSchema.parse(req.body);
        result = await db.item.upsert({ where: { id }, create: data, update: data });
        break;
      }
      case 'categories': {
        const data = categorySchema.parse(req.body);
        result = await db.category.upsert({ where: { id }, create: data, update: data });
        break;
      }
      case 'branches': {
        const data = branchSchema.parse(req.body);
        result = await db.branch.upsert({ where: { id }, create: data, update: data });
        break;
      }
      case 'zones': {
        const data = zoneSchema.parse(req.body);
        result = await db.deliveryZone.upsert({ where: { id }, create: data, update: data });
        break;
      }
      case 'promos': {
        const parsed = promoSchema.parse(req.body);
        const data = { ...parsed, expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null };
        result = await db.promoCode.upsert({ where: { id }, create: data, update: data });
        break;
      }
      case 'events': {
        const data = eventSchema.parse(req.body);
        result = await db.event.upsert({ where: { id }, create: data, update: data });
        break;
      }
    }
    res.json(result);
  }),
);
api.delete(
  '/admin/:entity/:id',
  wrap(async (req, res) => {
    const entity = entitySchema.parse(req.params.entity);
    if (req.user!.role !== 'owner') throw new ApiError(403, 'Owner access required');
    const where = { id: idParam(req) };
    switch (entity) {
      case 'items':
        await db.item.delete({ where });
        break;
      case 'categories':
        await db.category.delete({ where });
        break;
      case 'branches': {
        if ((await db.branch.count()) <= 1) throw new ApiError(400, 'Keep at least one branch');
        await db.branch.delete({ where });
        break;
      }
      case 'zones':
        await db.deliveryZone.delete({ where });
        break;
      case 'promos':
        await db.promoCode.delete({ where });
        break;
      case 'events':
        await db.event.delete({ where });
        break;
    }
    res.json({ deleted: true });
  }),
);
api.put(
  '/admin/settings',
  owner,
  wrap(async (req, res) => {
    const data = settingsSchema.parse(req.body);
    res.json(
      await db.setting.upsert({
        where: { id: 'site' },
        create: { id: 'site', data },
        update: { data },
      }),
    );
  }),
);
api.get(
  '/admin/users',
  owner,
  wrap(async (_req, res) =>
    res.json(await db.user.findMany({ select: { id: true, name: true, email: true, role: true } })),
  ),
);
api.patch(
  '/admin/users/:id/role',
  owner,
  wrap(async (req, res) => {
    const { role } = z.object({ role: z.enum(['customer', 'staff']) }).parse(req.body);
    const user = await db.user.findUnique({ where: { id: idParam(req) } });
    if (!user || user.role === 'owner') throw new ApiError(400, 'Cannot change this user role');
    const updated = await db.user.update({
      where: { id: user.id },
      data: { role, sessionVersion: { increment: 1 } },
    });
    res.json(safeUser(updated));
  }),
);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
  fileFilter: (_req, file, cb) =>
    cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
});
api.post(
  '/admin/uploads',
  upload.single('image'),
  wrap(async (req, res) => {
    if (!req.file) throw new ApiError(400, 'Upload a JPEG, PNG or WebP image (max 4 MB)');
    let image: Buffer;
    try {
      const source = sharp(req.file.buffer, { limitInputPixels: 25000000 });
      const metadata = await source.metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format || ''))
        throw new Error('Unsupported image');
      image = await source
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      throw new ApiError(400, 'Could not decode this image');
    }
    try {
      const url = await storeImage(image);
      res.status(201).json({ url });
    } catch {
      throw new ApiError(
        503,
        'Image storage is unavailable. Please try again or check the server storage settings.',
      );
    }
  }),
);
if (production) {
  app.get('/sitemap.xml', (_req, res) => {
    const base = publicUrl;
    if (!base) return res.status(503).type('text').send('Set PUBLIC_URL to generate the sitemap');
    const paths = [
      '/',
      '/menu',
      '/about',
      '/gallery',
      '/contact',
      '/branches',
      '/events',
      '/reservations',
    ];
    return res
      .type('application/xml')
      .send(
        `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${new URL(path, base).href.replaceAll('&', '&amp;')}</loc></url>`).join('')}</urlset>`,
      );
  });
  if (!process.env.VERCEL)
    app.use(
      express.static(webDirectory, {
        maxAge: '1h',
        setHeaders: (res, path) => {
          if (/-[A-Za-z0-9_-]{8}\.(js|css|woff2?)$/.test(path))
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          if (path.endsWith('sw.js') || path.endsWith('index.html'))
            res.setHeader('Cache-Control', 'no-cache');
        },
      }),
    );
  if (!process.env.VERCEL)
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/'))
        return next(new ApiError(404, 'Endpoint not found'));
      res.setHeader('Cache-Control', 'no-cache');
      return res.sendFile(resolve(webDirectory, 'index.html'));
    });
}
app.use((_req, _res, next) => next(new ApiError(404, 'Endpoint not found')));
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
    });
    return;
  }
  if (error instanceof ApiError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const status = error.code === 'P2002' ? 409 : error.code === 'P2025' ? 404 : 400;
    res.status(status).json({
      error:
        error.code === 'P2002'
          ? 'A record with these details already exists'
          : error.code === 'P2025'
            ? 'Record not found'
            : 'This record is still in use or has invalid references',
    });
    return;
  }
  if (error instanceof multer.MulterError) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (error instanceof SyntaxError) {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});
export { transitions };
