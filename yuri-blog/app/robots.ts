import type { MetadataRoute } from 'next';
import { getSettings } from '@/lib/settings';
export const dynamic = 'force-dynamic';
export default async function robots(): Promise<MetadataRoute.Robots> {
  const { site } = await getSettings();
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api', '/preview'] },
    ...(site.domain ? { sitemap: `${site.domain.replace(/\/$/, '')}/sitemap.xml` } : {}),
  };
}
