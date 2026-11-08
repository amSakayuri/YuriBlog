import { db } from './db';
import { getSettings } from './settings';
import { publicWhere } from './content';
const escape = (value: string) =>
  value.replace(
    /[<>&"']/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!,
  );
export async function feed(language: string) {
  const { site } = await getSettings();
  if (!site.domain)
    return new Response('RSS is available after the site domain is configured in CMS.', {
      status: 503,
    });
  const articles = await db.article.findMany({
    where: publicWhere(language),
    orderBy: { publishedAt: 'desc' },
    take: site.feedCount,
  });
  const prefix = language === 'en' ? '/en' : '';
  const base = site.domain.replace(/\/$/, '');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escape(site.feedTitle)}</title><link>${escape(base + prefix)}</link><description>${escape(site.feedDescription)}</description><language>${language === 'en' ? 'en' : 'zh-CN'}</language>${articles.map((a) => `<item><title>${escape(a.title)}</title><link>${escape(`${base}${prefix}/articles/${a.slug}`)}</link><guid isPermaLink="true">${escape(`${base}${prefix}/articles/${a.slug}`)}</guid><description>${escape(a.description)}</description><pubDate>${a.publishedAt!.toUTCString()}</pubDate></item>`).join('')}</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
