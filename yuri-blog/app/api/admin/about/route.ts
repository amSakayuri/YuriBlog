import { requireUser, checkOrigin, HttpError } from '@/lib/auth';
import { canManage } from '@/lib/content';
import { saveAbout } from '@/lib/about';
import { apiError } from '@/lib/http';
import { invalidateContent } from '@/lib/cache';

export async function PUT(request: Request) {
  try {
    checkOrigin(request);
    const actor = await requireUser();
    if (!canManage(actor.role, 'pages')) throw new HttpError(403, '没有编辑页面的权限');
    const page = await saveAbout({ ...(await request.json()), slug: 'about' }, actor.id);
    invalidateContent();
    return Response.json(page);
  } catch (error) {
    return apiError(error);
  }
}
