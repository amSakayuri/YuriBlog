import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { db } from '../yuri-blog/lib/db';
import { usernameSchema } from '../yuri-blog/lib/accounts';
import { hashPassword } from '../yuri-blog/lib/passwords';

async function main() {
  const mode = process.argv[2] ?? 'create';
  if (!['create', 'reset'].includes(mode)) throw new Error('模式必须为 create 或 reset');
  const username = usernameSchema.parse(process.env.ADMIN_USERNAME);
  const file = process.env.ADMIN_PASSWORD_FILE;
  if (!file) throw new Error('请设置 ADMIN_PASSWORD_FILE，使用仅自己可读的密码文件');
  const passwordHash = await hashPassword((await readFile(file, 'utf8')).replace(/\r?\n$/, ''));
  const name = process.env.ADMIN_NAME
    ? z.string().trim().min(1).max(100).parse(process.env.ADMIN_NAME)
    : undefined;
  await db.$transaction(async (tx) => {
    if (mode === 'create') {
      const user = await tx.user.create({
        data: { username, name: name ?? '管理员', passwordHash, role: 'SUPER_ADMIN' },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'BOOTSTRAP',
          resource: 'users',
          targetId: user.id,
          result: 'SUCCESS',
        },
      });
      return;
    }
    const existing = await tx.user.findUniqueOrThrow({ where: { username } });
    await tx.user.update({
      where: { id: existing.id },
      data: { passwordHash, ...(name ? { name } : {}) },
    });
    await tx.session.deleteMany({ where: { userId: existing.id } });
    const key = createHash('sha256').update(`password:${username}`).digest('hex');
    await tx.loginAttempt.deleteMany({ where: { key } });
    await tx.auditLog.create({
      data: {
        action: 'PASSWORD_RESET',
        resource: 'users',
        targetId: existing.id,
        result: 'SUCCESS',
      },
    });
  });
  console.log(
    mode === 'create'
      ? '管理员已创建，没有公开注册入口。'
      : '密码已重置，旧会话已撤销；角色与启用状态保持不变。',
  );
}
main()
  .catch(() => {
    console.error(
      '操作失败：检查用户名、密码文件、账户是否已存在及数据库连接。不会输出密码或哈希。',
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
