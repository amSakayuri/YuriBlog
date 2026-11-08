import { requireUser, checkOrigin } from '@/lib/auth';
import { db } from '@/lib/db';
import { siteSchema, giscusSchema, getSettings } from '@/lib/settings';
import { apiError } from '@/lib/http';
import { invalidateContent } from '@/lib/cache';
export async function GET() {
  try {
    await requireUser(['ADMIN', 'SUPER_ADMIN']);
    return Response.json(await getSettings());
  } catch (error) {
    return apiError(error);
  }
}
export async function PUT(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser(['ADMIN', 'SUPER_ADMIN']);
    const input = await request.json();
    const site = siteSchema.parse(input.site);
    const giscus = giscusSchema.parse(input.giscus);
    await db.$transaction(async (tx) => {
      for (const [key, value] of Object.entries({ site, giscus }))
        await tx.siteSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
      await tx.auditLog.create({
        data: { actorId: user.id, action: 'SETTINGS', resource: 'settings', result: 'SUCCESS' },
      });
    });
    invalidateContent();
    return Response.json({ site, giscus });
  } catch (error) {
    return apiError(error);
  }
}
