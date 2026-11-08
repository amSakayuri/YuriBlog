import { checkOrigin, requireUser, HttpError } from '@/lib/auth';
import { importMarkdown } from '@/lib/markdown-import';
import { apiError } from '@/lib/http';
import { invalidateContent } from '@/lib/cache';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const actor = await requireUser();
    const data = await request.formData();
    const file = data.get('file');
    if (!(file instanceof File)) throw new HttpError(400, '请选择Markdown文件');
    const article = await importMarkdown(file, actor.id);
    invalidateContent();
    return Response.json(article, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
