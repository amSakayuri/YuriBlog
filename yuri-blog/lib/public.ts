import { db } from './db';
import { publicWhere } from './content';
export function localePath(language: string, path: string) {
  return `${language === 'en' ? '/en' : ''}${path}`;
}
export const chapterOrder = [
  { volume: { order: 'asc' as const } },
  { order: 'asc' as const },
  { id: 'asc' as const },
];
export async function publicNovels(language: string) {
  return db.novel.findMany({
    where: { language, status: { not: 'DRAFT' } },
    include: { tags: { include: { tag: true } } },
    orderBy: { updatedAt: 'desc' },
  });
}
export async function publicArticles(language: string) {
  return db.article.findMany({
    where: publicWhere(language),
    include: { tags: { include: { tag: true } }, category: true },
    orderBy: { publishedAt: 'desc' },
  });
}
export async function searchDocuments(language: string) {
  const [articles, novels, essays, projects, chapters] = await Promise.all([
    publicArticles(language),
    publicNovels(language),
    db.essay.findMany({
      where: publicWhere(language),
      include: { tags: { include: { tag: true } } },
    }),
    db.project.findMany({ where: publicWhere(language) }),
    db.novelChapter.findMany({
      where: {
        status: 'PUBLISHED',
        publishedAt: { lte: new Date() },
        novel: { language, status: { not: 'DRAFT' } },
      },
      include: { novel: true },
    }),
  ]);
  return [
    ...articles.map((a) => ({
      id: a.id,
      type: 'Article',
      title: a.title,
      text: `${a.description} ${a.content} ${a.tags.map((t) => t.tag.name).join(' ')}`,
      url: localePath(language, `/articles/${a.slug}`),
    })),
    ...novels.map((a) => ({
      id: a.id,
      type: 'Novel',
      title: a.title,
      text: a.description,
      url: localePath(language, `/works/novels/${a.slug}`),
    })),
    ...essays.map((a) => ({
      id: a.id,
      type: 'Essay',
      title: a.title,
      text: `${a.description} ${a.content} ${a.tags.map((t) => t.tag.name).join(' ')}`,
      url: localePath(language, `/works/essays/${a.slug}`),
    })),
    ...projects.map((a) => ({
      id: a.id,
      type: 'Project',
      title: a.title,
      text: a.description,
      url: localePath(language, `/projects/${a.slug}`),
    })),
    ...chapters.map((a) => ({
      id: a.id,
      type: 'Chapter',
      title: a.title,
      text: a.summary,
      url: localePath(language, `/works/novels/${a.novel.slug}/${a.slug}`),
    })),
  ];
}
