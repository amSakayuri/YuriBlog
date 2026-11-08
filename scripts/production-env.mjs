import { randomBytes } from 'node:crypto';
import { writeFile, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';

export function validateProductionEnv(env) {
  const errors = [];
  for (const key of [
    'DATABASE_URL',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_DB',
    'APP_ORIGIN',
    'SITE_HOST',
    'WORKER_SECRET',
  ]) {
    if (!env[key] || /CHANGE_ME|YOUR_DOMAIN/.test(env[key]))
      errors.push(`${key}: required; replace example value`);
  }
  try {
    const origin = new URL(env.APP_ORIGIN);
    if (
      origin.protocol !== 'https:' ||
      origin.origin !== env.APP_ORIGIN ||
      origin.hostname !== env.SITE_HOST ||
      origin.username ||
      origin.password
    )
      errors.push('APP_ORIGIN: use https://SITE_HOST without path, credentials or trailing slash');
  } catch {
    errors.push('APP_ORIGIN: invalid URL');
  }
  if (!/^(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(env.SITE_HOST ?? ''))
    errors.push('SITE_HOST: hostname only');
  if ((env.POSTGRES_PASSWORD ?? '').length < 32)
    errors.push('POSTGRES_PASSWORD: at least 32 characters');
  if (!/^[a-f0-9]{64,}$/i.test(env.WORKER_SECRET ?? ''))
    errors.push('WORKER_SECRET: at least 64 random hex characters');
  try {
    const database = new URL(env.DATABASE_URL);
    if (
      !['postgresql:', 'postgres:'].includes(database.protocol) ||
      database.hostname !== 'postgres' ||
      decodeURIComponent(database.username) !== env.POSTGRES_USER ||
      decodeURIComponent(database.password) !== env.POSTGRES_PASSWORD ||
      decodeURIComponent(database.pathname.slice(1)) !== env.POSTGRES_DB
    )
      errors.push(
        'DATABASE_URL: credentials/database must match POSTGRES_* and host must be postgres',
      );
  } catch {
    errors.push('DATABASE_URL: invalid URL');
  }
  if (env.UPLOAD_DIR !== '/app/data/uploads')
    errors.push('UPLOAD_DIR: must be /app/data/uploads for Compose');
  return errors;
}
async function main() {
  const [mode, file, host] = process.argv.slice(2);
  if (mode === 'init') {
    if (!file || !host)
      throw new Error('Usage: node scripts/production-env.mjs init .env.production your.domain');
    const password = randomBytes(32).toString('hex');
    const env = {
      DATABASE_URL: `postgresql://yuri:${password}@postgres:5432/yuri_blog?schema=public`,
      POSTGRES_USER: 'yuri',
      POSTGRES_PASSWORD: password,
      POSTGRES_DB: 'yuri_blog',
      APP_ORIGIN: `https://${host}`,
      SITE_HOST: host,
      UPLOAD_DIR: '/app/data/uploads',
      WORKER_SECRET: randomBytes(32).toString('hex'),
      INTERNAL_APP_URL: 'http://web:3000',
    };
    const errors = validateProductionEnv(env);
    if (errors.length) throw new Error(errors.join('\n'));
    await writeFile(
      file,
      Object.entries(env)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n') + '\n',
      { flag: 'wx', mode: 0o600 },
    );
    console.log(
      'Created environment file with random secrets; existing files are never overwritten.',
    );
  } else if (mode === 'check' || mode === 'check-env') {
    if (mode === 'check' && !file)
      throw new Error('Usage: node scripts/production-env.mjs check .env.production');
    const values = mode === 'check-env' ? process.env : parseEnv(await readFile(file, 'utf8'));
    const errors = validateProductionEnv(values);
    if (errors.length) throw new Error(errors.join('\n'));
    console.log('PASS: production environment structure (secret values omitted).');
  } else throw new Error('Expected init, check, or check-env');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
