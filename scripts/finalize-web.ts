import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
// Run after `vite build`: lists the built JS/CSS/fonts in the service worker so the app works offline.
const dist = resolve(process.cwd().endsWith('web') ? 'dist' : 'apps/web/dist');
const assets = await readdir(resolve(dist, 'assets'));
const precache = assets
  .filter((file) => /\.(js|css|woff2)$/.test(file))
  .map((file) => `/assets/${file}`);
const sw = await readFile(resolve(dist, 'sw.js'), 'utf8');
const hash = createHash('sha256').update(JSON.stringify(precache)).digest('hex').slice(0, 12);
await writeFile(
  resolve(dist, 'sw.js'),
  sw
    .replace(/const PRECACHE\s*=\s*\[\];/, `const PRECACHE=${JSON.stringify(precache)};`)
    .replace('crowd-static-v1', `crowd-static-${hash}`)
    .replace(
      /'\/assets\/emblem\.webp',\s*'\/assets\/iced-pair\.webp',\s*'\/assets\/logo-source\.webp',/,
      "'/assets/crowd/badge.webp','/assets/crowd/logo.webp','/assets/crowd/photo-croissant-cup.webp',",
    ),
);
console.log(`Prepared the offline cache with ${precache.length} built assets.`);
