import { requireUser, checkOrigin, HttpError } from '@/lib/auth';
import { canManage, listContent, writeContent, removeContent } from '@/lib/content';
import { schemas, type Resource } from '@/lib/validation';
import { apiError } from '@/lib/http';
import { invalidateContent } from '@/lib/cache';
type Context = { params: Promise<{ resource: string }> };
async function context(ctx: Context) {
  const user = await requireUser();
  const { resource } = await ctx.params;
  if (!Object.hasOwn(schemas,resource)) throw new HttpError(404, '资源不存在');
  if (!canManage(user.role, resource)) throw new HttpError(403, '没有操作权限');
  return { user, resource: resource as Resource };
}
export async function GET(request: Request, ctx: Context) {
  try {
    const { resource } = await context(ctx);
    const url = new URL(request.url);
    return Response.json(
      await listContent(
        resource,
        url.searchParams.get('q') ?? '',
        url.searchParams.get('novelId') ?? undefined,
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request, ctx: Context) {
  try {
    checkOrigin(request);
    const { user, resource } = await context(ctx);
    const data = await writeContent(resource, await request.json(), user.id);
    invalidateContent();
    return Response.json(data, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
export async function PUT(request: Request, ctx: Context) {
  try {
    checkOrigin(request);
    const { user, resource } = await context(ctx);
    const id = new URL(request.url).searchParams.get('id');
    if (!id) throw new HttpError(400, '缺少 ID');
    const data = await writeContent(resource, await request.json(), user.id, id);
    invalidateContent();
    return Response.json(data);
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(request: Request, ctx: Context) {
  try {
    checkOrigin(request);
    const { user, resource } = await context(ctx);
    const id = new URL(request.url).searchParams.get('id');
    if (!id) throw new HttpError(400, '缺少 ID');
    await removeContent(resource, id, user.id);
    invalidateContent();
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
