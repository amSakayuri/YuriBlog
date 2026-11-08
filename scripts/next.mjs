import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const envFile = join(root, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const require = createRequire(import.meta.url);
const [command, ...options] = process.argv.slice(2);
if (!['dev', 'build', 'start', 'typegen'].includes(command))
  throw new Error('Unknown Next.js command');
// Load .env before spawning: --env-file flags otherwise leak into Next build workers' NODE_OPTIONS.
const child = spawn(
  process.execPath,
  [require.resolve('next/dist/bin/next'), command, 'yuri-blog', ...options],
  { cwd: root, stdio: 'inherit', env: process.env },
);
process.on('SIGTERM', () => child.kill('SIGTERM'));
child.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
