import { app } from './app.js';
import { db } from './db.js';
const port = Number(process.env.PORT || 4011);
await db.$connect();
const host = process.env.HOST || '127.0.0.1';
const server = app.listen(port, host, () => console.log(`Galal Coffee API http://${host}:${port}`));
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => {
    server.close(() => {
      void db.$disconnect().then(() => process.exit(0));
    });
  });
