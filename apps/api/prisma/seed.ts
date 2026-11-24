import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { categorySchema, itemSchema, branchSchema, settingsSchema } from '@crowd/shared';
import {
  seedItems,
  seedCategories,
  defaultSettings,
  crowdItems,
  crowdCategories,
  crowdSettings,
} from '@crowd/shared';
// Seeds the Crowd starter menu (set SEED_BRAND=starter to seed the generic starter menu instead).
const crowd = process.env.SEED_BRAND !== 'starter';
const catalog = {
  items: crowd ? crowdItems : seedItems,
  categories: crowd ? crowdCategories : seedCategories,
  branches: [] as unknown[],
  settings: crowd ? crowdSettings : defaultSettings,
};
const db = new PrismaClient();
try {
  for (const category of catalog.categories.map((category) => categorySchema.parse(category)))
    await db.category.upsert({ where: { id: category.id }, create: category, update: {} });
  for (const item of catalog.items.map((item) => itemSchema.parse(item)))
    await db.item.upsert({ where: { id: item.id }, create: item, update: {} });
  for (const branch of catalog.branches.map((branch) => branchSchema.parse(branch)))
    await db.branch.upsert({ where: { id: branch.id }, create: branch, update: {} });
  await db.setting.upsert({
    where: { id: 'site' },
    create: { id: 'site', data: settingsSchema.parse(catalog.settings) },
    update: {},
  });
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72)
    throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (12+ characters) in .env');
  await db.user.upsert({
    where: { email },
    create: {
      email,
      password: await bcrypt.hash(password, 12),
      name: 'Crowd Owner',
      role: 'owner',
    },
    update: {},
  });
  console.log(
    `Seeded the ${crowd ? 'Crowd' : 'starter'} reference collection with unconfirmed pricing and owner ${email}. Existing records and passwords preserved. New sites start in preview mode.`,
  );
} finally {
  await db.$disconnect();
}
