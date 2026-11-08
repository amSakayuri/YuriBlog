import { z } from 'zod';

import { Prisma } from '@prisma/client';
import { requireUser, checkOrigin, HttpError } from '@/lib/auth';
import { db } from '@/lib/db';
import { apiError } from '@/lib/http';
import { hashPassword, passwordSchema } from '@/lib/passwords';
import { usernameSchema } from '@/lib/accounts';
const select = {
  id: true,
  username: true,
  name: true,
  role: true,
  active: true,
  createdAt: true,
};
export async function GET() {
  try {
    await requireUser(['SUPER_ADMIN']);
    return Response.json(await db.user.findMany({ select, orderBy: { createdAt: 'asc' } }));
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const actor = await requireUser(['SUPER_ADMIN']);
    const input = z
      .object({
        username: usernameSchema,
        name: z.string().trim().min(1).max(100),
        password: passwordSchema,
        role: z.enum(['SUPER_ADMIN', 'ADMIN', 'EDITOR']),
      })
      .parse(
        await request.json().catch(() => {
          throw new HttpError(400, '请求格式不正确');
        }),
      );
    const passwordHash = await hashPassword(input.password);
    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { username: input.username, name: input.name, role: input.role, passwordHash },
        select,
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'CREATE',
          resource: 'users',
          targetId: created.id,
          result: 'SUCCESS',
        },
      });
      return created;
    });
    return Response.json(user, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
export async function PUT(request: Request) {
  try {
    checkOrigin(request);
    const actor = await requireUser(['SUPER_ADMIN']);
    const input = z
      .object({
        id: z.string(),
        role: z.enum(['SUPER_ADMIN', 'ADMIN', 'EDITOR']),
        active: z.boolean(),
        username: usernameSchema.optional(),
      })
      .parse(await request.json());
    if (input.id === actor.id && (!input.active || input.role !== 'SUPER_ADMIN'))
      throw new HttpError(400, '不能停用或降低自己的超级管理员权限');
    const user = await db.$transaction(
      async (tx) => {
        const existing = await tx.user.findUniqueOrThrow({ where: { id: input.id } });
        if (
          existing.role === 'SUPER_ADMIN' &&
          existing.active &&
          (!input.active || input.role !== 'SUPER_ADMIN')
        ) {
          const count = await tx.user.count({ where: { role: 'SUPER_ADMIN', active: true } });
          if (count <= 1) throw new HttpError(400, '至少保留一个超级管理员');
        }
        const result = await tx.user.update({
          where: { id: input.id },
          data: {
            role: input.role,
            active: input.active,
            ...(input.username?{username:input.username}:{}),
          },
          select,
        });
        await tx.session.deleteMany({ where: { userId: input.id } });
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            action: 'PERMISSION',
            resource: 'users',
            targetId: input.id,
            result: 'SUCCESS',
          },
        });
        return result;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return Response.json(user);
  } catch (error) {
    return apiError(error);
  }
}
