import EmbeddedPostgres from 'embedded-postgres';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

// Development only: persistent, real PostgreSQL with loopback-only network binding.
const directory = resolve('.local');
mkdirSync(directory, { recursive: true });
const credentialsPath = resolve(directory, 'credentials.json');
const credentials = existsSync(credentialsPath)
  ? JSON.parse(readFileSync(credentialsPath, 'utf8'))
  : {
      password: randomBytes(24).toString('hex'),
      secret: randomBytes(48).toString('hex'),
      adminPassword: randomBytes(18).toString('base64url'),
    };
if (!existsSync(credentialsPath))
  writeFileSync(credentialsPath, JSON.stringify(credentials), { mode: 0o600 });
if (!existsSync('.env'))
  writeFileSync(
    '.env',
    `DATABASE_URL=postgresql://crowd:${credentials.password}@127.0.0.1:54340/crowd?schema=public\nJWT_SECRET=${credentials.secret}\nWEB_ORIGIN=http://localhost:5184,http://127.0.0.1:5184\nPORT=4011\nNODE_ENV=development\nSEED_ADMIN_EMAIL=owner@crowd.local\nSEED_ADMIN_PASSWORD=${credentials.adminPassword}\n`,
    { mode: 0o600 },
  );
const db = new EmbeddedPostgres({
  databaseDir: resolve(directory, 'postgres'),
  user: 'crowd',
  password: credentials.password,
  port: 54340,
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  postgresFlags: ['-h', '127.0.0.1'],
  onLog: () => {},
  onError: (message) => console.error(String(message)),
});
if (!existsSync(resolve(directory, 'postgres', 'PG_VERSION'))) await db.initialise();
await db.start();
const client = db.getPgClient();
await client.connect();
const result = await client.query("SELECT 1 FROM pg_database WHERE datname='crowd_utf8'");
if (!result.rowCount)
  await client.query(
    "CREATE DATABASE crowd_utf8 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0",
  );
const envContent = readFileSync('.env', 'utf8');
if (envContent.includes(':54340/crowd?'))
  writeFileSync('.env', envContent.replace(':54340/crowd?', ':54340/crowd_utf8?'), {
    mode: 0o600,
  });
await client.end();
console.log('Local PostgreSQL ready on 127.0.0.1:54340. Credentials are in ignored .env.');
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await db.stop();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 60000);
