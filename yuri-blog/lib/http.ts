import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { HttpError } from './auth';
export function apiError(error: unknown) {
  if (error instanceof HttpError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError)
    return Response.json(
      { error: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('；') },
      { status: 400 },
    );
  if (error instanceof Prisma.PrismaClientKnownRequestError)
    return Response.json(
      {
        error:
          error.code === 'P2002'
            ? 'Slug、名称或关系已存在'
            : error.code === 'P2003'
              ? '关联数据不存在或仍被引用'
              : error.code === 'P2025'
                ? '记录不存在'
                : '数据库约束未满足',
      },
      { status: 409 },
    );
  console.error(error instanceof Error ? error.message : 'Unknown server error');
  return Response.json({ error: '服务暂时不可用，请检查数据库连接后重试' }, { status: 500 });
}
