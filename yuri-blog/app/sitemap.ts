import type { MetadataRoute } from 'next';
import { getSettings } from '@/lib/settings';
import { searchDocuments } from '@/lib/public';
import { db } from '@/lib/db';
export const dynamic = 'force-dynamic';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { site } = await getSettings();
  if (!site.domain) return [];
  const root = site.domain.replace(/\/$/, '');
  const documents = (await Promise.all(['zh', 'en'].map(searchDocuments))).flat();
  const pages=await db.page.findMany({where:{status:'PUBLISHED',publishedAt:{lte:new Date()}}});
  const tags=await db.tag.findMany({where:{OR:[{articles:{some:{article:{status:'PUBLISHED',publishedAt:{lte:new Date()}}}}},{essays:{some:{essay:{status:'PUBLISHED',publishedAt:{lte:new Date()}}}}},{novels:{some:{novel:{status:{not:'DRAFT'}}}}}]}});
  return [
    ...[
      '',
      '/articles',
      '/works',
      '/projects',
      '/archive',
      '/tags',
      '/about',
      '/en',
      '/en/articles',
      '/en/works',
      '/en/projects',
      '/en/archive',
      '/en/tags',
      '/en/about',
    ].map((path) => ({ url: root + path })),
    ...documents.map((d) => ({ url: root + d.url })),
    ...pages.map(page=>({url:`${root}${page.language==='en'?'/en':''}/${page.slug}`})),
    ...tags.flatMap(tag=>['', '/en'].map(prefix=>({url:`${root}${prefix}/tags/${tag.slug}`}))),
  ];
}
