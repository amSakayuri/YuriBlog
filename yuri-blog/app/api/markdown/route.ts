import { z } from 'zod';
import { requireUser, checkOrigin } from '@/lib/auth';
import { renderMarkdown } from '@/lib/markdown';
import { apiError } from '@/lib/http';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    await requireUser();
    const { content } = z.object({ content: z.string().max(2000000) }).parse(await request.json());
    return Response.json(await renderMarkdown(content));
  } catch (error) {
    return apiError(error);
  }
}
