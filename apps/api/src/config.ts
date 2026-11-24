import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { config } from 'dotenv';
let directory = process.cwd();
while (!process.env.VERCEL && !existsSync(resolve(directory, 'apps/web/package.json'))) {
  const parent = dirname(directory);
  if (parent === directory) throw new Error('Run crowd Coffee from its project directory');
  directory = parent;
}
export const rootDirectory = directory;
config({ path: resolve(directory, '.env'), quiet: true });
export const uploadsDirectory = resolve(directory, 'uploads');
export const webDirectory = resolve(directory, 'apps/web/dist');
