# Crowd Speciality Coffee

Reusable English/Arabic café ordering and operations website for Crowd Speciality Coffee. React 18 + TypeScript + Vite frontend, Express + Prisma + PostgreSQL API, shared Zod schemas, and persistent dine-in table ordering, split-bill groups, cashier scan, barista KDS, account, and admin flows.

## Run locally (from a fresh GitHub clone)

> For production deployment (Vercel / Neon / Cloudinary), see [VERCEL-SETUP.md](VERCEL-SETUP.md). Local setup and testing do not publish anything publicly.

### Prerequisites

- **Node.js 24 LTS or later** and **npm** (verified with Node `v24.14.0` on Windows).
- **Git** to clone the repository.
- *(Optional)* **Docker Desktop** if you prefer Docker over the built-in local PostgreSQL.

### 1. Clone and install

```bash
git clone <YOUR_GITHUB_REPO_URL>
cd Crowd-cafe
npm ci
npm run db:generate
npm run build -w @crowd/shared
```

> **Note:** Always run `npm run build -w @crowd/shared` after a fresh clone (or after editing `packages/shared`) so `@crowd/api` and `@crowd/web` can resolve the compiled shared package.

### 2. Start PostgreSQL

Choose **one** of the following two options:

#### Option A — Built-in local PostgreSQL (No Docker required, recommended)

Run this in **its own terminal** and keep it running while you develop:

```bash
npm run db:local
```

What it does automatically on first run:
- Starts an isolated development-only PostgreSQL instance bound to `127.0.0.1:54340`.
- Persists data locally under `.local/` (git-ignored).
- Creates the UTF-8 database (`crowd_utf8`).
- Generates random local credentials and creates `.env` (git-ignored) if one does not exist.

Stop it anytime with `Ctrl+C`. Do **not** use `db:local` in production.

#### Option B — Docker Compose

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` and set:
   - `POSTGRES_PASSWORD` and matching password in `DATABASE_URL` (port `54340`)
   - `JWT_SECRET` (random string, 32+ characters)
   - `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` (12+ characters)
3. Start the database container:
   ```bash
   docker compose up -d
   ```

### 3. Migrate, seed, and run the app

In a **second terminal** (while PostgreSQL is running):

```bash
npm run db:deploy
npm run db:seed
npm run dev
```

This starts both servers concurrently:
- **Frontend (Web):** http://127.0.0.1:5184/ (or http://localhost:5184/)
- **Backend (API):** http://127.0.0.1:4011/api/menu (health check: http://127.0.0.1:4011/api/health)

### 4. First-time Owner Sign-in

1. Open your `.env` file and copy `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`.
2. Go to http://127.0.0.1:5184/account and sign in.
3. Open `/admin` to add a **Branch**, set item **Prices**, and mark items as **Available** & **Price Confirmed**.

> The seed script (`npm run db:seed`) is idempotent and preserves existing records and passwords. To register a staff member, create a normal customer account at `/account` and promote them under **Team access** in `/admin`.

### Troubleshooting

- **Cannot connect to database / `P1001`:** Make sure `npm run db:local` (or `docker compose up -d`) is running in another terminal on port `54340`.
- **Module not found `@crowd/shared`:** Run `npm run build -w @crowd/shared`.
- **Prisma client not found:** Run `npm run db:generate`.
- **Port already in use (`5184`, `4011`, `54340`):** Stop any previous dev server or PostgreSQL instance using those ports.

## What works

- **Dine-in table QR ordering:** Customers open `/menu?table=5`, select items, customize drink options, and place dine-in orders directly from their phones.
- **Group orders & split bills ("With Friends"):** Tag items with individual names on the same table. The system automatically computes person-by-person bill splits and totals.
- **Pickup codes & live tracking:** Generates a 6-character short code (e.g. `K7M 2Q9`) and a 20-minute expiring QR code at `/table-order/:id`. Automatically tracks status changes (`awaiting_payment` ➔ `confirmed` ➔ `preparing` ➔ `ready`).
- **Cashier desk (`/cashier`):** Staff camera QR scanning (via `BarcodeDetector` with `jsQR` fallback) or manual code entry. Inspects item breakdown, confirms cash payment atomically, and routes the ticket to the barista screen.
- **Barista kitchen display (`/kitchen`):** 3-column live kanban board (`New`, `In Progress`, `Ready`) with high-visibility table badges, customer names, one-tap status advancement, sound notifications on new orders, and 4-second auto-polling.
- **Brand skin & loading screen:** Custom Crowd "Paper & Ink" design language with light and dark theme support, responsive cup-filling animation loader on initial load and refresh.
- **Arabic RTL & English:** Bilingual interface with bundled web fonts (`Londrina Solid`, `Lalezar`, `Tajawal`, `DM Sans`) and optional Arabic-Indic numerals.
- **Admin dashboard (`/admin`):** Menu management, categories, branches, price configuration, item availability toggles, table QR code generator for printing, and staff permissions.
- **Offline PWA:** Installable Progressive Web App with service worker caching for offline shell navigation.

## Reference and brand data

- **Brand:** Crowd Speciality Coffee (`apps/web/src/skins/crowd/brand.ts`).
- **Palette:** Paper `#F1F4E9`, Ink `#121212`, Orange `#F1791E`, and Lime `#64C132` (`theme.ts`).
- **Assets:** Clean vector badges, photo assets, and font loaders bundled in `apps/web/public/assets/crowd/`.
- **Order Flow:** Detailed breakdown of table orders, cashier validation, and barista stages in `ORDER-FLOW.md`.

## Rebrand

- Edit `apps/web/src/skins/crowd/theme.ts`: colors, fonts, radii, spacing, and shadows.
- Edit `apps/web/src/skins/crowd/copy.ts`: bilingual text and messaging overrides.
- Replace artwork in `apps/web/public/assets/crowd/`.
- Manage live operational content, branches, and pricing through `/admin`.

## Project structure

- `apps/web/src/`: Customer site, table ordering, cashier terminal, kitchen screen, admin dashboard, and Crowd skin.
- `apps/web/public/`: Bundled fonts, brand icons, manifest, and loader script.
- `apps/api/src/`: Authenticated Express REST API, rate limit store, and order validation.
- `apps/api/prisma/`: PostgreSQL schema, migrations, starter catalog, and seed script.
- `packages/shared/src/`: Shared TypeScript types, Zod schemas, and price calculation logic.
- `scripts/`: Development embedded PostgreSQL runner and web asset helpers.
- `tests/`: Vitest, Supertest, and table-order lifecycle integration tests.

## Verification

With local PostgreSQL running and seeded:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Production

See [DEPLOYMENT.md](DEPLOYMENT.md), [VERCEL-SETUP.md](VERCEL-SETUP.md), and [CLOUDINARY-SETUP.md](CLOUDINARY-SETUP.md) for production hosting, Vercel edge configuration, and media storage setup.
