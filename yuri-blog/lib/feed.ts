import { db } from './db';
import { siteSchema } from './settings';
import { publicWhere } from './content';
import type { PrismaClient } from '@prisma/client';
const escape = (value: string) =>
  value.replace(
    /[<>&"']/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!,
  );
type FeedItem = { title: string; path: string; description: string; date: Date; category: string };
export async function feed(
  language: string,
  kind: 'articles' | 'works' = 'articles',
  store: PrismaClient = db,
) {
  const site = siteSchema.parse(
    (await store.siteSetting.findUnique({ where: { key: 'site' } }))?.value ?? {},
  );
  if (!site.domain)
    return new Response('RSS is available after the site domain is configured in CMS.', {
      status: 503,
    });
  const articles =
    kind === 'articles'
      ? await store.article.findMany({
          where: publicWhere(language),
          orderBy: { publishedAt: 'desc' },
          take: site.feedCount,
        })
      : [];
  let entries: FeedItem[] = articles.map((a) => ({
    title: a.title,
    path: `/articles/${encodeURIComponent(a.slug)}`,
    description: a.description,
    date: a.publishedAt!,
    category: language === 'en' ? 'Article' : '杂谈',
  }));
  if (kind === 'works') {
    const [essays, novels, chapters] = await Promise.all([
      store.essay.findMany({
        where: publicWhere(language),
        orderBy: { updatedAt: 'desc' },
        take: site.feedCount,
      }),
      store.novel.findMany({
        where: { language, status: { not: 'DRAFT' } },
        orderBy: { updatedAt: 'desc' },
        take: site.feedCount,
      }),
      store.novelChapter.findMany({
        where: {
          status: 'PUBLISHED',
          publishedAt: { lte: new Date() },
          novel: { language, status: { not: 'DRAFT' } },
        },
        include: { novel: { select: { slug: true, title: true } } },
        orderBy: { updatedAt: 'desc' },
        take: site.feedCount,
      }),
    ]);
    entries = [
      ...essays.map((a) => ({
        title: a.title,
        path: `/works/essays/${encodeURIComponent(a.slug)}`,
        description: a.description,
        date: new Date(Math.max(a.updatedAt.getTime(), a.publishedAt!.getTime())),
        category: language === 'en' ? 'Essay' : '散文',
      })),
      ...novels.map((a) => ({
        title: a.title,
        path: `/works/novels/${encodeURIComponent(a.slug)}`,
        description: a.description,
        date: a.updatedAt,
        category: language === 'en' ? 'Novel' : '小说',
      })),
      ...chapters.map((a) => ({
        title: `${a.novel.title} · ${a.title}`,
        path: `/works/novels/${encodeURIComponent(a.novel.slug)}/${encodeURIComponent(a.slug)}`,
        description: a.summary,
        date: new Date(Math.max(a.updatedAt.getTime(), a.publishedAt!.getTime())),
        category: language === 'en' ? 'Chapter' : '小说章节',
      })),
    ]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, site.feedCount);
  }
  const prefix = language === 'en' ? '/en' : '';
  const base = site.domain.replace(/\/$/, '');
  const label =
    kind === 'works'
      ? language === 'en'
        ? 'Literary works'
        : '文学作品'
      : language === 'en'
        ? 'Articles'
        : '杂谈';
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escape(site.feedTitle + ' · ' + label)}</title><link>${escape(base + prefix + (kind === 'works' ? '/works' : '/articles'))}</link><description>${escape(site.feedDescription || label)}</description><language>${language === 'en' ? 'en' : 'zh-CN'}</language>${entries.map((a) => `<item><title>${escape(a.title)}</title><link>${escape(`${base}${prefix}${a.path}`)}</link><guid isPermaLink="true">${escape(`${base}${prefix}${a.path}`)}</guid><description>${escape(a.description)}</description><category>${escape(a.category)}</category><pubDate>${a.date.toUTCString()}</pubDate></item>`).join('')}</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
