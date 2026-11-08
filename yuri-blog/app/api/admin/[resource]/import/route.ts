import { checkOrigin, requireUser, HttpError } from '@/lib/auth';
import { importMarkdown, type MarkdownResource } from '@/lib/markdown-import';
import { db } from '@/lib/db';
import { apiError } from '@/lib/http';
import { invalidateContent } from '@/lib/cache';

export async function POST(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    checkOrigin(request);
    const actor = await requireUser();
    const { resource } = await context.params;
    if (!['essays', 'novels', 'chapters'].includes(resource))
      throw new HttpError(404, '不支持此内容类型的Markdown导入');
    const data = await request.formData();
    const file = data.get('file');
    if (!(file instanceof File)) throw new HttpError(400, '请选择Markdown文件');
    const novelId = data.get('novelId');
    const volumeId = data.get('volumeId');
    if (resource === 'chapters' && (typeof novelId !== 'string' || !novelId))
      throw new HttpError(400, '请先选择小说');
    const record = await importMarkdown(file, actor.id, db, {
      resource: resource as MarkdownResource,
      novelId: typeof novelId === 'string' ? novelId : undefined,
      volumeId: typeof volumeId === 'string' ? volumeId : null,
    });
    invalidateContent();
    return Response.json(record, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
