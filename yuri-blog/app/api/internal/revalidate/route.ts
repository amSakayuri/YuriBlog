import { timingSafeEqual } from 'node:crypto';
import { invalidateContent } from '@/lib/cache';
export async function POST(request: Request) {
  const expected = process.env.WORKER_SECRET;
  const value = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (
    !expected ||
    !value ||
    expected.length !== value.length ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(value))
  )
    return new Response(null, { status: 403 });
  invalidateContent();
  return Response.json({ ok: true });
}
