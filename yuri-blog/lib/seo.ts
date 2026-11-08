import type { Metadata } from 'next';
import { db } from './db';
import { getSettings } from './settings';
import { publicWhere } from './content';
export async function publicMetadata(segments: string[]): Promise<Metadata> {
  const { site } = await getSettings();
  const en = segments[0] === 'en';
  const language = en ? 'en' : 'zh';
  const route = en ? segments.slice(1) : segments;
  let title = site.title,
    description = site.description,
    image = site.ogImage;
  let counterpart: string | undefined;
  const [section, slug, workSlug, chapterSlug] = route;
  if (section === 'articles' && slug) {
    const row = await db.article.findFirst({ where: { ...publicWhere(language), slug } });
    if (row) {
      title = row.seoTitle || row.title;
      description = row.seoDescription || row.description;
      image = row.ogImage || row.cover || image;
      if (row.translationKey) {
        const other = await db.article.findFirst({
          where: { ...publicWhere(en ? 'zh' : 'en'), translationKey: row.translationKey },
        });
        if (other) counterpart = `/articles/${other.slug}`;
      }
    }
  } else if (section === 'works' && slug === 'novels' && workSlug) {
    const row = await db.novel.findFirst({
      where: { language, slug: workSlug, status: { not: 'DRAFT' } },
    });
    if (row) {
      title = row.title;
      description = row.description;
      image = row.cover || image;
      if (chapterSlug) {
        const chapter = await db.novelChapter.findFirst({
          where: {
            novelId: row.id,
            slug: chapterSlug,
            status: 'PUBLISHED',
            publishedAt: { lte: new Date() },
          },
        });
        if (chapter) {
          title = `${chapter.title} · ${row.title}`;
          description = chapter.summary || row.description;
        }
      } else if (row.translationKey) {
        const other = await db.novel.findFirst({
          where: {
            language: en ? 'zh' : 'en',
            translationKey: row.translationKey,
            status: { not: 'DRAFT' },
          },
        });
        if (other) counterpart = `/works/novels/${other.slug}`;
      }
    }
  } else if (section === 'works' && slug === 'essays' && workSlug) {
    const row = await db.essay.findFirst({ where: { ...publicWhere(language), slug: workSlug } });
    if (row) {
      title = row.seoTitle || row.title;
      description = row.seoDescription || row.description;
      image = row.ogImage || row.cover || image;
      if (row.translationKey) {
        const other = await db.essay.findFirst({
          where: { ...publicWhere(en ? 'zh' : 'en'), translationKey: row.translationKey },
        });
        if (other) counterpart = `/works/essays/${other.slug}`;
      }
    }
  } else if (section === 'projects' && slug) {
    const row = await db.project.findFirst({ where: { ...publicWhere(language), slug } });
    if (row) {
      title = row.title;
      description = row.description;
      image = row.cover || image;
      if (row.translationKey) {
        const other = await db.project.findFirst({
          where: { ...publicWhere(en ? 'zh' : 'en'), translationKey: row.translationKey },
        });
        if (other) counterpart = `/projects/${other.slug}`;
      }
    }
  } else if (section) {
    const names: Record<string, string[]> = {
      articles: ['文章', 'Articles'],
      works: ['文学作品', 'Literary works'],
      projects: ['项目', 'Projects'],
      archive: ['归档', 'Archive'],
      tags: ['标签', 'Tags'],
      search: ['搜索', 'Search'],
      about: ['关于', 'About'],
      rss: ['RSS 订阅', 'RSS subscriptions'],
    };
    title = names[section]?.[en ? 1 : 0] ?? site.title;
    const page = await db.page.findFirst({ where: { ...publicWhere(language), slug: section } });
    if (page) {
      title = page.title;
      description = page.content.replace(/[#*`>]/g, '').slice(0, 160);
    }
  }
  const path = '/' + segments.join('/');
  const opposite = en ? 'zh-CN' : 'en';
  const languages: Record<string, string> = { [en ? 'en' : 'zh-CN']: path };
  if (counterpart) languages[opposite] = (en ? '' : '/en') + counterpart;
  else if (route.length <= 1) languages[opposite] = (en ? '' : '/en') + '/' + route.join('/');
  return {
    title: title === site.title ? site.title : `${title} · ${site.title}`,
    description,
    metadataBase: site.domain ? new URL(site.domain) : undefined,
    alternates: {
      canonical: path,
      languages,
      types: {
        'application/rss+xml': [
          { url: `${en ? '/en' : ''}/feed.xml`, title: en ? 'Articles' : '杂谈' },
          { url: `${en ? '/en' : ''}/works/feed.xml`, title: en ? 'Literary works' : '文学作品' },
        ],
      },
    },
    openGraph: {
      title,
      description,
      url: path,
      type: section === 'articles' && slug ? 'article' : 'website',
      siteName: site.title,
      locale: en ? 'en_US' : 'zh_CN',
      ...(image ? { images: [image] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
    icons: site.favicon ? { icon: site.favicon } : undefined,
  };
}
