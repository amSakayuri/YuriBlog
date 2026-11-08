import type { Metadata } from 'next';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { delegate } from '@/lib/content';
import { renderMarkdown } from '@/lib/markdown';
import { Prose } from '@/components/public/site';
import { ReadingTools } from '@/components/article/reading-tools';
import { RelationGraph } from '@/components/novel/relation-graph';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '内容预览', robots: { index: false, follow: false } };
export default async function Preview({
  params,
}: {
  params: Promise<{ resource: string; id: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/admin/login');
  const { resource, id } = await params;
  if (!['articles', 'essays', 'chapters', 'novels', 'projects', 'pages'].includes(resource))
    notFound();
  const record = await delegate(db, resource as 'articles').findUnique({ where: { id } });
  if (!record) notFound();
  const markdown = await renderMarkdown(String(record.content ?? record.description ?? ''));
  let relations: React.ReactNode;
  if (resource === 'novels') {
    const chapters = await db.novelChapter.findMany({
      where: { novelId: id },
      orderBy: { order: 'asc' },
    });
    const links = await db.chapterRelation.findMany({ where: { novelId: id } });
    relations = (
      <>
        <h2>全部章节（含草稿）</h2>
        <ol>
          {chapters.map((chapter) => (
            <li key={chapter.id}>
              <a href={`/preview/chapters/${chapter.id}`}>{chapter.title}</a> · {chapter.status}
            </li>
          ))}
        </ol>
        <h2>章节关系</h2>
        <RelationGraph
          chapters={chapters.map((chapter) => ({ ...chapter, slug: chapter.id }))}
          relations={links}
          base="/preview/chapters"
        />
      </>
    );
  }
  return (
    <main
      id="main-content"
      className={`public-main preview-main ${['novels', 'essays', 'chapters'].includes(resource) ? 'literary' : ''}`}
    >
      <div className="preview-banner">
        私有预览 · {String(record.status)} · 不对外公开{' '}
        <a href={`/admin/${resource === 'chapters' ? 'novels/' + record.novelId : resource}`}>
          返回编辑
        </a>
      </div>
      <article>
        <header className="article-heading">
          <h1>{String(record.title)}</h1>
          <p className="lead">{String(record.description ?? record.summary ?? '')}</p>
        </header>
        <ReadingTools toc={markdown.toc} />
        <Prose html={markdown.html} />
        {relations}
      </article>
    </main>
  );
}
