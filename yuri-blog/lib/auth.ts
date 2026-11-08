import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { verifyPassword } from './passwords';
import { db } from './db';
import type { Role } from '@prisma/client';
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');
export const cookieName =
  process.env.NODE_ENV === 'production' ? '__Host-yuri_session' : 'yuri_session';
export async function currentUser() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;
  return {
    id: session.user.id,
    username: session.user.username,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
  };
}
export async function requireUser(roles: Role[] = ['SUPER_ADMIN', 'ADMIN', 'EDITOR']) {
  const user = await currentUser();
  if (!user) throw new HttpError(401, '请先登录');
  if (!roles.includes(user.role)) throw new HttpError(403, '当前账号无权执行此操作');
  return user;
}
export function checkOrigin(request: Request) {
  const expected = process.env.APP_ORIGIN ?? new URL(request.url).origin;
  if (request.headers.get('origin') !== expected) throw new HttpError(403, '请求来源不匹配');
}
export async function rateLimitLogin(identity: string) {
  const key = hashToken(identity);
  // Atomic PostgreSQL upsert keeps rate limits consistent across concurrent requests and restarts.
  const [attempt] = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "LoginAttempt" ("key","count","resetAt") VALUES (${key},1,NOW()+INTERVAL '15 minutes')
    ON CONFLICT ("key") DO UPDATE SET "count"=CASE WHEN "LoginAttempt"."resetAt"<NOW() THEN 1 ELSE "LoginAttempt"."count"+1 END,
    "resetAt"=CASE WHEN "LoginAttempt"."resetAt"<NOW() THEN NOW()+INTERVAL '15 minutes' ELSE "LoginAttempt"."resetAt" END RETURNING "count"`;
  if (attempt.count > 8) throw new HttpError(429, '尝试次数过多，请 15 分钟后重试');
}
export async function createSession(userId: string) {
  const jar = await cookies();
  const previous = jar.get(cookieName)?.value;
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12);
  await db.$transaction(async (tx) => {
    if (previous) await tx.session.deleteMany({ where: { tokenHash: hashToken(previous) } });
    await tx.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });
    await tx.auditLog.create({
      data: { actorId: userId, action: 'LOGIN', resource: 'auth', result: 'SUCCESS' },
    });
  });
  jar.set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    expires: expiresAt,
  });
}
export async function authenticatePassword(username: string, password: string) {
  const normalizedUsername = username.trim().toLowerCase();
  const identity = `password:${normalizedUsername}`;
  await rateLimitLogin(identity);
  const user = await db.user.findUnique({ where: { username: normalizedUsername } });
  const valid = await verifyPassword(user?.passwordHash, password);
  if (!valid || !user?.active) {
    await db.auditLog.create({ data: { action: 'LOGIN', resource: 'auth', result: 'FAILED' } });
    throw new HttpError(401, '用户名或密码不正确');
  }
  await db.loginAttempt.deleteMany({ where: { key: hashToken(identity) } });
  return user;
}
export async function logout() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(cookieName);
}
