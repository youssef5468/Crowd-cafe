import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Crowd's look lives in src/skins/crowd (brand, theme, copy, home page, loading screen).
// '@skin/*' imports resolve there, and the HTML shell (title, manifest, loading screen) is filled in below.
const skin = 'crowd';
function skinHtml() {
  const read = (file: string) =>
    readFileSync(new URL(`./src/skins/${skin}/${file}`, import.meta.url), 'utf8');
  return {
    name: 'skin-html',
    transformIndexHtml: {
      order: 'pre' as const,
      handler: (html: string) =>
        html
          .replace('<!--skin:head-->', read('head.html'))
          .replace('<!--skin:body-->', read('body.html'))
          .replace('data-skin="crowd"', `data-skin="${skin}"`),
    },
  };
}
export default defineConfig({
  plugins: [skinHtml(), react(), tailwindcss()],
  resolve: { alias: { '@skin': fileURLToPath(new URL(`./src/skins/${skin}`, import.meta.url)) } },
  server: {
    port: 5184,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:4011', '/uploads': 'http://127.0.0.1:4011' },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/zod/')) return 'validation';
          if (id.includes('/node_modules/framer-motion/') || id.includes('/node_modules/motion-'))
            return 'motion';
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/react-router')
          )
            return 'react';
        },
      },
    },
  },
});
