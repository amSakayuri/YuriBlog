import { z } from 'zod';
import { requireUser, checkOrigin, HttpError } from '@/lib/auth';
import { db } from '@/lib/db';
import { apiError } from '@/lib/http';
import { invalidateContent } from '@/lib/cache';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    const input = z
      .object({
        resource: z.enum(['chapters', 'volumes']),
        novelId: z.string(),
        ids: z.array(z.string()).min(1).max(2000),
      })
      .parse(await request.json());
    if (new Set(input.ids).size !== input.ids.length) throw new HttpError(400, '排序包含重复章节');
    await db.$transaction(async (tx) => {
      if (input.resource === 'chapters') {
        const count = await tx.novelChapter.count({
          where: { id: { in: input.ids }, novelId: input.novelId },
        });
        if (count !== input.ids.length) throw new HttpError(400, '章节不属于当前小说');
        for (const [order, id] of input.ids.entries())
          await tx.novelChapter.update({ where: { id }, data: { order } });
      } else {
        const count = await tx.novelVolume.count({
          where: { id: { in: input.ids }, novelId: input.novelId },
        });
        if (count !== input.ids.length) throw new HttpError(400, '卷不属于当前小说');
        for (const [order, id] of input.ids.entries())
          await tx.novelVolume.update({ where: { id }, data: { order } });
      }
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'REORDER',
          resource: input.resource,
          targetId: input.novelId,
          result: 'SUCCESS',
        },
      });
    });
    invalidateContent();
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
