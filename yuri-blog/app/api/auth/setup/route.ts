import { checkOrigin, createSession, HttpError } from '@/lib/auth';
import { administratorCount, bootstrapAdministrator } from '@/lib/accounts';
import { apiError } from '@/lib/http';
export async function GET() {
  return Response.json(
    { available: (await administratorCount()) === 0 },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await bootstrapAdministrator(
      await request.json().catch(() => {
        throw new HttpError(400, '请求格式不正确');
      }),
    );
    await createSession(user.id);
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
