// A local QA process only: no external listener, no deployment or global environment changes.
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
const child = spawn(process.execPath, [resolve('apps/api/dist/apps/api/src/index.js')], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    LOCAL_PRODUCTION_PREVIEW: '1',
    HOST: '127.0.0.1',
    PORT: '4011',
    PUBLIC_URL: 'http://127.0.0.1:4011',
    WEB_ORIGIN: 'http://127.0.0.1:4011',
  },
});
process.on('SIGINT', () => child.kill());
process.on('SIGTERM', () => child.kill());
child.on('exit', (code) => process.exit(code ?? 0));
