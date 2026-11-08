import { randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(12, '密码至少需要 12 位')
  .max(200)
  .refine((value) => !/[\r\n]/.test(value), '密码不能包含换行');
const options = { algorithm: 2 as const, memoryCost: 19456, timeCost: 3, parallelism: 1 };

export async function hashPassword(password: string) {
  return hash(passwordSchema.parse(password), options);
}

let dummyHash: Promise<string> | undefined;
export async function verifyPassword(storedHash: string | undefined, password: string) {
  const usable = storedHash?.startsWith('$argon2id$') ?? false;
  // Unknown users and uninitialized credentials still incur password verification cost.
  const encoded = usable ? storedHash! : await (dummyHash ??= hash(randomBytes(32), options));
  const valid = await verify(encoded, password).catch(() => false);
  return usable && valid;
}
