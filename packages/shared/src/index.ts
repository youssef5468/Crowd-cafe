import { z } from 'zod';

export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s()-]/g, ''))
  .refine((v) => /^(?:\+20|0020|0)1[0125]\d{8}$/.test(v), 'Enter a valid Egyptian mobile number')
  .transform((v) =>
    v.startsWith('0020') ? `+${v.slice(2)}` : v.startsWith('0') ? `+20${v.slice(1)}` : v,
  );
export const bilingualSchema = z.object({
  name_en: z.string().trim().min(1).max(150),
  name_ar: z.string().trim().min(1).max(150),
});
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a valid 24-hour time');
export const variantSchema = bilingualSchema.extend({
  id: z.string().min(1),
  price: z.number().int().min(0).max(100000),
});
export const categorySchema = bilingualSchema.extend({
  id: z.string().min(1),
  sort: z.number().int().default(0),
});
export const itemSchema = bilingualSchema.extend({
  id: z.string().min(1),
  categoryId: z.string().min(1),
  description_en: z.string().max(1000).default(''),
  description_ar: z.string().max(1000).default(''),
  image: z.string().max(500).nullable().default(null),
  available: z.boolean().default(true),
  priceConfirmed: z.boolean().default(false),
  featured: z.boolean().default(false),
  temperature: z.enum(['hot', 'cold']).default('hot'),
  vegan: z.boolean().default(false),
  caffeineFree: z.boolean().default(false),
  variants: z.array(variantSchema).min(1).max(10),
  addons: z.array(variantSchema).max(20).default([]),
});
export const branchSchema = bilingualSchema
  .extend({
    id: z.string().min(1),
    address_en: z.string().min(1).max(500),
    address_ar: z.string().min(1).max(500),
    phone: phoneSchema.nullable(),
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),
    open: timeSchema,
    close: timeSchema,
    ramadanOpen: timeSchema.nullable().default(null),
    ramadanClose: timeSchema.nullable().default(null),
  })
  .refine((branch) => (branch.lat === null) === (branch.lng === null), {
    message: 'Enter both map coordinates or leave both blank for citywide pickup',
    path: ['lat'],
  });
export const zoneSchema = bilingualSchema.extend({
  id: z.string().min(1),
  fee: z.number().int().min(0).max(10000),
  minimum: z.number().int().min(0).max(100000),
  active: z.boolean().default(true),
});
export const promoSchema = z.object({
  id: z.string().min(1),
  code: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .transform((v) => v.toUpperCase()),
  percent: z.number().int().min(1).max(100),
  minimum: z.number().int().min(0).default(0),
  expiresAt: z.string().datetime().nullable().default(null),
  active: z.boolean().default(true),
});
export const orderLineSchema = z.object({
  itemId: z.string().min(1),
  variantId: z.string().min(1),
  addonIds: z.array(z.string()).max(10).default([]),
  quantity: z.number().int().min(1).max(30),
  notes: z.string().trim().max(300).default(''),
});
export const orderSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    phone: phoneSchema,
    fulfillment: z.enum(['pickup', 'delivery']),
    branchId: z.string().min(1),
    zoneId: z.string().optional(),
    address: z.string().trim().max(500).default(''),
    notes: z.string().trim().max(500).default(''),
    promoCode: z.string().trim().max(30).default(''),
    items: z.array(orderLineSchema).min(1).max(50),
    payment: z.enum(['cash', 'pickup']).default('pickup'),
  })
  .superRefine((v, ctx) => {
    if (v.fulfillment === 'delivery' && (!v.zoneId || v.address.length < 10))
      ctx.addIssue({
        code: 'custom',
        message: 'Delivery needs a zone and a full address',
        path: ['address'],
      });
    if (v.fulfillment === 'pickup' && v.payment !== 'pickup')
      ctx.addIssue({
        code: 'custom',
        message: 'Pickup orders are paid at pickup',
        path: ['payment'],
      });
    if (v.fulfillment === 'delivery' && v.payment !== 'cash')
      ctx.addIssue({
        code: 'custom',
        message: 'Delivery orders require cash on delivery',
        path: ['payment'],
      });
  });
export const tableOrderLineSchema = orderLineSchema.extend({
  person: z.string().trim().max(40).default(''),
});
// Dine-in order: built at the table, paid in cash at the cashier by scanning the short code.
export const tableOrderSchema = z.object({
  tableNumber: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{1,10}$/),
  branchId: z.string().min(1).optional(),
  name: z.string().trim().max(100).default(''),
  notes: z.string().trim().max(500).default(''),
  items: z.array(tableOrderLineSchema).min(1).max(50),
});
export const reservationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: phoneSchema,
  branchId: z.string().min(1),
  date: z.iso.date(),
  time: timeSchema,
  partySize: z.coerce.number().int().min(1).max(12),
  notes: z.string().trim().max(500).default(''),
});
export const loginSchema = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(10).max(128),
});
export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2).max(100),
  password: z
    .string()
    .min(10)
    .max(128)
    .refine(
      (v) => new TextEncoder().encode(v).length <= 72,
      'Password must be no longer than 72 UTF-8 bytes',
    ),
});
export const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().email().max(254),
  message: z.string().trim().min(10).max(3000),
});
export const addressSchema = z.object({
  label: z.string().trim().min(1).max(60),
  address: z.string().trim().min(10).max(500),
});
export const reviewSchema = z.object({
  name: z.string().trim().min(2).max(100),
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().min(10).max(1000),
});
export const settingsSchema = z.object({
  previewMode: z.boolean(),
  ramadanMode: z.boolean(),
  arabicNumerals: z.boolean(),
  whatsappEnabled: z.boolean(),
  facebook: z.union([z.string().url(), z.literal('')]),
  instagram: z.union([z.string().url(), z.literal('')]),
  about_en: z.string().max(5000),
  about_ar: z.string().max(5000),
  theme: z.record(z.string(), z.string().max(200)).default({}),
});
export const statuses = [
  'awaiting_payment',
  'received',
  'confirmed',
  'preparing',
  'ready',
  'out_for_delivery',
  'completed',
  'cancelled',
] as const;
export const statusSchema = z.enum(statuses);
export const reservationStatusSchema = z.enum(['pending', 'confirmed', 'cancelled']);
export type MenuItem = z.infer<typeof itemSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Branch = z.infer<typeof branchSchema>;
export type Zone = z.infer<typeof zoneSchema>;
export type Promo = z.infer<typeof promoSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type OrderInput = z.infer<typeof orderSchema>;
export type TableOrderInput = z.infer<typeof tableOrderSchema>;
export type ReservationInput = z.infer<typeof reservationSchema>;
export type OrderStatus = z.infer<typeof statusSchema>;
export type User = {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'staff' | 'customer';
  addresses: { label: string; address: string }[];
};
export type OrderRecord = {
  id: string;
  accessToken: string;
  branchId: string;
  name: string;
  phone: string;
  fulfillment: string;
  address: string;
  notes: string;
  subtotal: number;
  fee: number;
  discount: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
  demo: boolean;
  tableNumber?: string | null;
  pickupCode?: string | null;
  codeExpiresAt?: string | null;
  paidAt?: string | null;
  items: {
    person?: string;
    name_en: string;
    name_ar: string;
    variant_en: string;
    variant_ar: string;
    quantity: number;
    unitPrice: number;
    notes: string;
    addons: string[];
  }[];
};
export type ReservationRecord = ReservationInput & {
  id: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  demo: boolean;
};
export type ReviewRecord = {
  id: string;
  name: string;
  rating: number;
  text: string;
  approved: boolean;
  createdAt: string;
};
export type MenuResponse = {
  items: MenuItem[];
  categories: Category[];
  settings: Settings;
  branches: Branch[];
};
export const defaultSettings: Settings = {
  previewMode: true,
  ramadanMode: false,
  arabicNumerals: false,
  whatsappEnabled: false,
  facebook: 'https://www.facebook.com/crowdcoffee1/',
  instagram: '',
  about_en: 'Coffee, cold drinks, chocolate and a breakfast bite. Welcome to Crowd Coffee.',
  about_ar: 'قهوة ومشروبات باردة وشوكولاتة وفطار. أهلاً بيك في Crowd.',
  theme: {},
};
export { cairoDate, isOpen } from './runtime.js';
export const seedCategories: Category[] = [
  { id: 'coffee', name_en: 'Coffee', name_ar: 'قهوة', sort: 0 },
  { id: 'cold', name_en: 'Cold drinks', name_ar: 'مشروبات باردة', sort: 1 },
  { id: 'chocolate', name_en: 'Chocolate', name_ar: 'شوكولاتة', sort: 2 },
  { id: 'breakfast', name_en: 'Breakfast', name_ar: 'فطار', sort: 3 },
];
export const seedItems: MenuItem[] = [
  {
    id: 'hot-coffee',
    name_en: 'Hot coffee',
    name_ar: 'قهوة ساخنة',
    categoryId: 'coffee',
    image: '/assets/hot-coffee.webp',
    temperature: 'hot',
    description_en: 'A Crowd cup, served hot.',
    description_ar: 'كوباية Crowd، سخنة.',
  },
  {
    id: 'iced-coffee',
    name_en: 'Iced coffee',
    name_ar: 'قهوة مثلجة',
    categoryId: 'cold',
    image: '/assets/iced-pair.webp',
    temperature: 'cold',
    description_en: 'Coffee on ice, in a Crowd cup.',
    description_ar: 'قهوة على تلج، في كوباية Crowd.',
  },
  {
    id: 'choco-marshmallow',
    name_en: 'Choco marshmallow',
    name_ar: 'شوكولاتة مارشميلو',
    categoryId: 'chocolate',
    image: '/assets/choco-marshmallow.webp',
    temperature: 'hot',
    description_en: 'Chocolate with a marshmallow topping.',
    description_ar: 'شوكولاتة مع مارشميلو.',
  },
  {
    id: 'choco-popcorn',
    name_en: 'Choco pop corn',
    name_ar: 'شوكولاتة بوب كورن',
    categoryId: 'chocolate',
    image: '/assets/choco-popcorn.webp',
    temperature: 'hot',
    description_en: 'The chocolate drink shown in our Crowd collection.',
    description_ar: 'مشروب الشوكولاتة من مجموعة Crowd.',
  },
  {
    id: 'breakfast',
    name_en: 'Breakfast sandwich',
    name_ar: 'ساندوتش فطار',
    categoryId: 'breakfast',
    image: '/assets/breakfast.webp',
    temperature: 'hot',
    description_en: 'A breakfast bite alongside your drink.',
    description_ar: 'فطار جنب مشروبك.',
  },
].map((item) => ({
  ...item,
  temperature: item.temperature as 'hot' | 'cold',
  available: false,
  priceConfirmed: false,
  featured: true,
  vegan: false,
  caffeineFree: false,
  variants: [{ id: item.id + '-standard', name_en: 'Standard', name_ar: 'عادي', price: 0 }],
  addons: [],
}));
export const cafeHours = { open: '10:00', close: '03:00', timeZone: 'Africa/Cairo' } as const;
// Blank editor defaults, never a public branch. Verified addresses and contacts must be entered by the owner.
export const seedBranch: Branch = {
  id: '',
  name_en: '',
  name_ar: '',
  address_en: '',
  address_ar: '',
  phone: '',
  lat: null,
  lng: null,
  open: cafeHours.open,
  close: cafeHours.close,
  ramadanOpen: null,
  ramadanClose: null,
};

// ---- Dine-in pickup codes -------------------------------------------------------
// Unambiguous alphabet (no 0/O, 1/I/L) so a code can be read out loud or typed by hand.
export const PICKUP_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const PICKUP_CODE_LENGTH = 6;
export const PICKUP_CODE_TTL_MINUTES = 20;
const pickupCodePattern = new RegExp(`^[${PICKUP_CODE_ALPHABET}]{${PICKUP_CODE_LENGTH}}$`);
/** Accepts a raw code ("k7m2q9"), or a scanned link that carries it ("https://site/cashier?code=K7M2Q9"). */
export function parsePickupCode(scanned: string): string | null {
  let candidate = scanned.trim();
  try {
    candidate = new URL(candidate).searchParams.get('code') ?? '';
  } catch {
    /* not a URL: treat the text as the code itself */
  }
  const code = candidate.replace(/[\s-]/g, '').toUpperCase();
  return pickupCodePattern.test(code) ? code : null;
}
export function isCodeExpired(
  expiresAt: string | Date | null | undefined,
  now: number = Date.now(),
): boolean {
  return !expiresAt || new Date(expiresAt).getTime() <= now;
}
/** Per-person totals for group orders, in order of first appearance. Lines with no name count as "". */
export function personTotals(
  items: { person?: string; quantity: number; unitPrice: number }[],
): { person: string; total: number }[] {
  const totals = new Map<string, number>();
  for (const line of items) {
    const person = (line.person ?? '').trim();
    totals.set(person, (totals.get(person) ?? 0) + line.quantity * line.unitPrice);
  }
  return [...totals].map(([person, total]) => ({ person, total }));
}

// ---- Crowd Speciality Coffee: starter catalog (names and photos from the brand's own posts) ------
// Prices are not known yet, so every item starts unconfirmed and unavailable, exactly like crowd's.
export const crowdCategories: Category[] = [
  { id: 'frappes', name_en: 'Frappes', name_ar: 'فرابيه', sort: 0 },
  { id: 'coffee', name_en: 'Coffee', name_ar: 'قهوة', sort: 1 },
  { id: 'sandwiches', name_en: 'Sandwiches', name_ar: 'ساندوتشات', sort: 2 },
  { id: 'baked', name_en: 'Baked goods', name_ar: 'مخبوزات', sort: 3 },
  { id: 'sweet', name_en: 'Sweet tooth', name_ar: 'حلويات', sort: 4 },
];
const crowdRaw = [
  [
    'iced-spanish-latte',
    'Iced Spanish Latte',
    'آيس سبانش لاتيه',
    'coffee',
    'cold',
    'p-iced-spanish-latte',
    'Our best seller, based on your votes.',
    'الأكتر مبيعاً، حسب تصويتكم.',
    true,
  ],
  [
    'pistachio-frappe',
    'Pistachio Frappe',
    'فرابيه فستق',
    'frappes',
    'cold',
    'p-pistachio-frappe',
    'Pistachio, blended cold.',
    'فستق متخلط بارد.',
    true,
  ],
  [
    'mocha-frappe',
    'Mocha Frappe',
    'فرابيه موكا',
    'frappes',
    'cold',
    'p-mocha-frappe',
    'Chocolate and coffee, blended cold.',
    'شوكولاتة وقهوة متخلطين بارد.',
    true,
  ],
  [
    'caramel-frappe',
    'Caramel Frappe',
    'فرابيه كراميل',
    'frappes',
    'cold',
    'p-caramel-frappe',
    'Caramel, blended cold.',
    'كراميل متخلط بارد.',
    false,
  ],
  [
    'chicken-honey-mustard-ciabatta',
    'Chicken Honey Mustard Ciabatta',
    'تشيكن هاني ماستارد شباتا',
    'sandwiches',
    'hot',
    'p-honey-mustard-ciabatta',
    'Baked goods for every Crowd.',
    'مخبوزات لكل Crowd.',
    true,
  ],
  [
    'chicken-pesto-brown',
    'Chicken Pesto Brown',
    'تشيكن بيستو بني',
    'sandwiches',
    'hot',
    'p-pesto-brown',
    'Baked goods for every Crowd.',
    'مخبوزات لكل Crowd.',
    false,
  ],
  [
    'chicken-ranch-focaccia',
    'Chicken Ranch Focaccia',
    'تشيكن رانش فوكاتشيا',
    'sandwiches',
    'hot',
    'p-ranch-focaccia',
    'Baked goods for every Crowd.',
    'مخبوزات لكل Crowd.',
    false,
  ],
  [
    'smoked-turkey-croissant',
    'Smoked Turkey Croissant',
    'كرواسون ديك رومي مدخن',
    'sandwiches',
    'hot',
    'p-smoked-turkey-croissant',
    'Baked goods for every Crowd.',
    'مخبوزات لكل Crowd.',
    false,
  ],
  [
    'croissant',
    'Croissant',
    'كرواسون',
    'baked',
    'hot',
    'cut-croissant',
    'Baked goods for the indulgers.',
    'مخبوزات للمدلّعين.',
    false,
  ],
  [
    'chocolate-cake',
    'Chocolate Cake',
    'كيك شوكولاتة',
    'sweet',
    'hot',
    'p-chocolate-cake',
    'Some days are made for chocolate.',
    'فيه أيام متعملة للشوكولاتة.',
    false,
  ],
] as const;
export const crowdItems: MenuItem[] = crowdRaw.map(
  ([
    id,
    name_en,
    name_ar,
    categoryId,
    temperature,
    image,
    description_en,
    description_ar,
    featured,
  ]) => ({
    id,
    name_en,
    name_ar,
    categoryId,
    image: `/assets/crowd/${image}.webp`,
    temperature,
    description_en,
    description_ar,
    available: false,
    priceConfirmed: false,
    featured,
    vegan: false,
    caffeineFree: false,
    variants: [{ id: `${id}-standard`, name_en: 'Standard', name_ar: 'عادي', price: 0 }],
    addons: [],
  }),
);
export const crowdSettings: Settings = {
  ...defaultSettings,
  facebook: '',
  instagram: '',
  about_en: 'Speciality coffee and baked goods, made for every Crowd.',
  about_ar: 'قهوة مختصة ومخبوزات، متعملة لكل Crowd.',
};
