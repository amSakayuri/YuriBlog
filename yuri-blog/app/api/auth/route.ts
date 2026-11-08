import { z } from 'zod';
import { checkOrigin, authenticatePassword, createSession, logout, HttpError } from '@/lib/auth';
import { apiError } from '@/lib/http';
import { usernameSchema } from '@/lib/accounts';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const input = z
      .object({
        username: usernameSchema,
        password: z.string().min(1).max(200),
      })
      .parse(
        await request.json().catch(() => {
          throw new HttpError(400, '请求格式不正确');
        }),
      );
    const user = await authenticatePassword(input.username, input.password);
    await createSession(user.id);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    await logout();
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
