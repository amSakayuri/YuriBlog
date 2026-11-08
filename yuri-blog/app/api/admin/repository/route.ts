import { z } from 'zod';
import { requireUser, checkOrigin, HttpError } from '@/lib/auth';
import { db } from '@/lib/db';
import { apiError } from '@/lib/http';
import { invalidateContent } from '@/lib/cache';
import { repositorySchema, repositorySettings, synchronizeRepository } from '@/lib/repository';
export const maxDuration = 300;
export async function GET() {
  try {
    await requireUser(['SUPER_ADMIN']);
    return Response.json({
      config: await repositorySettings(),
      state: await db.repositoryState.findUnique({ where: { id: 'content' } }),
      credentialsConfigured: Boolean(
        process.env.CONTENT_REPO_PRIVATE_KEY_FILE && process.env.CONTENT_REPO_KNOWN_HOSTS_FILE,
      ),
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function PUT(request: Request) {
  try {
    checkOrigin(request);
    const actor = await requireUser(['SUPER_ADMIN']);
    const config = repositorySchema.parse(await request.json());
    const previous = await repositorySettings();
    await db.$transaction(async (tx) => {
      const [lock] = await tx.$queryRaw<
        { locked: boolean }[]
      >`SELECT pg_try_advisory_xact_lock(19870518) AS locked`;
      if (!lock.locked) throw new HttpError(409, '同步任务正在执行，请稍后修改仓库设置');
      await tx.siteSetting.upsert({
        where: { key: 'repository' },
        create: { key: 'repository', value: config },
        update: { value: config },
      });
      if (previous.remote !== config.remote || previous.branch !== config.branch)
        await tx.repositoryState.deleteMany();
      await tx.auditLog.create({
        data: { actorId: actor.id, action: 'SETTINGS', resource: 'repository', result: 'SUCCESS' },
      });
    });
    return Response.json({ ok: true });
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
        action: z.enum(['push', 'preview', 'pull']),
        expected: z.object({ localHash: z.string(), remoteCommit: z.string() }).optional(),
      })
      .parse(await request.json());
    const result = await synchronizeRepository(input.action, actor.id, input.expected);
    if (input.action === 'pull') invalidateContent();
    return Response.json(result);
  } catch (error) {
    return apiError(error);
  }
}
