import { z } from 'zod';
import { db } from './db';
import { hashPassword, passwordSchema } from './passwords';
import { HttpError } from './auth';
import type { PrismaClient } from '@prisma/client';

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, '用户名限3–40位字母、数字、下划线或短横线');
export const administratorInput = z.object({
  username: usernameSchema,
  name: z.string().trim().min(1).max(100),
  password: passwordSchema,
});
export function administratorCount(store: PrismaClient = db) {
  // Disabled administrators still count: disabling a user must never reopen public setup.
  return store.user.count({ where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } } });
}
export async function bootstrapAdministrator(input: unknown, store: PrismaClient = db) {
  const data = administratorInput.parse(input);
  if (await administratorCount(store)) throw new HttpError(409, '管理员已存在，首次创建入口已关闭');
  const passwordHash = await hashPassword(data.password);
  return store.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(19870517)`;
    if (await tx.user.count({ where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } } }))
      throw new HttpError(409, '管理员已存在，首次创建入口已关闭');
    const user = await tx.user.create({
      data: { username: data.username, name: data.name, passwordHash, role: 'SUPER_ADMIN' },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: 'BOOTSTRAP',
        resource: 'users',
        targetId: user.id,
        result: 'SUCCESS',
      },
    });
    return user;
  });
}
