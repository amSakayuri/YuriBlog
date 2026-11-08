import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { schemas, type Resource } from '@/lib/validation';
import { canManage } from '@/lib/content';
import { AboutEditor } from '@/components/admin/about';
import { getSettings } from '@/lib/settings';
import { AdminShell } from '@/components/admin/shell';
import { Login } from '@/components/admin/login';
import { administratorCount } from '@/lib/accounts';
import { Collection } from '@/components/admin/collection';
import { SettingsEditor } from '@/components/admin/settings';
import { MediaLibrary } from '@/components/admin/media';
import { NovelManager } from '@/components/admin/novel-manager';
import { Users } from '@/components/admin/users';
import { RepositoryManager } from '@/components/admin/repository';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Yuri Blog · CMS',
  robots: { index: false, follow: false },
};
export default async function Admin({ params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await params;
  const [section, id] = segments;
  const user = await currentUser();
  if (section === 'login') {
    if (user) redirect('/admin');
    return <Login setupAvailable={(await administratorCount()) === 0} />;
  }
  if (!user) redirect('/admin/login');
  let content: React.ReactNode;
  if (!section) {
    const [total, published, draft, novels, essays, projects, media, logs] = await Promise.all([
      db.article.count(),
      db.article.count({ where: { status: 'PUBLISHED' } }),
      db.article.count({ where: { status: 'DRAFT' } }),
      db.novel.count(),
      db.essay.count(),
      db.project.count(),
      db.mediaAsset.count(),
      db.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 12,
        include: { actor: { select: { name: true } } },
      }),
    ]);
    content = (
      <>
        <div className="admin-heading">
          <div>
            <h1>内容概览</h1>
            <p className="muted">欢迎回来，{user.name}。</p>
          </div>
          <Link href="/admin/articles" className="button button-default">
            新建文章
          </Link>
        </div>
        <dl className="dashboard-stats">
          {[
            ['文章', total],
            ['已发布文章', published],
            ['文章草稿', draft],
            ['小说', novels],
            ['散文', essays],
            ['项目', projects],
            ['媒体', media],
          ].map(([label, count]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{count}</dd>
            </div>
          ))}
        </dl>
        <section>
          <h2>快捷操作</h2>
          <div className="actions">
            {[
              ['articles', '新建文章'],
              ['novels', '新建小说'],
              ['essays', '新建散文'],
              ['projects', '新建项目'],
              ['media', '上传图片'],
            ].map(([route, label]) => (
              <Link className="button button-outline" href={`/admin/${route}`} key={route}>
                {label}
              </Link>
            ))}
          </div>
        </section>
        <section>
          <h2>最近修改</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>时间</th>
                  <th>操作者</th>
                  <th>操作</th>
                  <th>资源</th>
                  <th>结果</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.createdAt.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</td>
                    <td>{log.actor?.name ?? '系统'}</td>
                    <td>{log.action}</td>
                    <td>{log.resource}</td>
                    <td>{log.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!logs.length && <p className="empty">暂无操作记录。</p>}
          </div>
        </section>
      </>
    );
  } else if (!canManage(user.role, section === 'about' ? 'pages' : section)) {
    content = (
      <>
        <h1>没有访问权限</h1>
        <p>请联系管理员调整账号角色。</p>
      </>
    );
  } else if (section === 'about' && !id) {
    const pages = await db.page.findMany({
      where: { slug: 'about', language: { in: ['zh', 'en'] } },
    });
    content = (
      <AboutEditor
        initial={pages.map((page) => ({
          ...page,
          publishedAt: page.publishedAt?.toISOString() ?? null,
        }))}
      />
    );
  } else if (section === 'novels' && id) {
    const novel = await db.novel.findUnique({ where: { id } });
    if (!novel) notFound();
    content = <NovelManager novelId={id} title={novel.title} />;
  } else if (Object.hasOwn(schemas, section) && segments.length === 1)
    content = <Collection resource={section as Resource} />;
  else if (section === 'settings' || section === 'giscus')
    content = (
      <SettingsEditor
        section={section === 'settings' ? 'site' : 'giscus'}
        initial={await getSettings()}
      />
    );
  else if (section === 'media') content = <MediaLibrary />;
  else if (section === 'repository')
    content =
      user.role === 'SUPER_ADMIN' ? <RepositoryManager /> : <p>只有超级管理员可以管理内容仓库。</p>;
  else if (section === 'users') {
    if (user.role !== 'SUPER_ADMIN') content = <p>只有超级管理员可以管理用户。</p>;
    else content = <Users />;
  } else if (section === 'audit-logs') {
    const logs = await db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { actor: { select: { name: true } } },
    });
    content = (
      <>
        <h1>操作日志</h1>
        <p className="muted">最近 200 条。不记录密码或会话令牌。</p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>时间</th>
                <th>操作者</th>
                <th>操作</th>
                <th>资源 / ID</th>
                <th>结果</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.createdAt.toISOString()}</td>
                  <td>{log.actor?.name ?? '系统'}</td>
                  <td>{log.action}</td>
                  <td>
                    {log.resource}
                    <small>{log.targetId}</small>
                  </td>
                  <td>{log.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  } else notFound();
  return (
    <AdminShell name={user.name} role={user.role}>
      {content}
    </AdminShell>
  );
}
