/* eslint-disable @next/next/no-img-element -- CMS assets are processed by Sharp; remote content URLs are author-configurable. */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { publicWhere } from '@/lib/content';
import {
  publicArticles,
  publicNovels,
  localePath,
  chapterOrder,
  searchDocuments,
} from '@/lib/public';
import { publicMarkdown as renderMarkdown } from '@/lib/markdown-cache';
import { Header } from './header';
import { Search } from './search';
import { ReadingTools } from '@/components/article/reading-tools';
import { Comments } from '@/components/giscus/comments';
import { RelationGraph } from '@/components/novel/relation-graph';
import { Reader, ContinueReading } from '@/components/novel/reader';

export function Empty({ en = false }: { en?: boolean }) {
  return <p className="empty">{en ? 'Nothing published yet.' : '这里还没有已发布的内容。'}</p>;
}
export function Prose({ html }: { html: string }) {
  return <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />;
}
type ListItem = {
  id: string;
  title: string;
  slug: string;
  description?: string;
  publishedAt?: Date | null;
  updatedAt?: Date;
  cover?: string;
  tags?: { tag: { name: string; slug: string } }[];
};
export function ContentList({
  items,
  base,
  language,
}: {
  items: ListItem[];
  base: string;
  language: string;
}) {
  return items.length ? (
    <div className="content-list">
      {items.map((item) => (
        <article key={item.id}>
          <time>{(item.publishedAt ?? item.updatedAt)?.toISOString().slice(0, 10)}</time>
          <div>
            <h2>
              <Link href={`${base}/${item.slug}`}>{item.title}</Link>
            </h2>
            {item.description && <p>{item.description}</p>}
            {item.tags && (
              <div className="tag-row">
                {item.tags.map(({ tag }) => (
                  <Link key={tag.slug} href={localePath(language, `/tags/${tag.slug}`)}>
                    #{tag.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  ) : (
    <Empty en={language === 'en'} />
  );
}
async function translationLink(
  kind: 'article' | 'novel' | 'essay' | 'project',
  translationKey: string | null,
  language: string,
  path: (slug: string) => string,
) {
  if (!translationKey)
    return localePath(
      language === 'en' ? 'zh' : 'en',
      kind === 'article' ? '/articles' : kind === 'project' ? '/projects' : '/works',
    );
  const opposite = language === 'en' ? 'zh' : 'en';
  const table = db[kind] as unknown as {
    findFirst(args: unknown): Promise<{ slug: string } | null>;
  };
  const row = await table.findFirst({
    where: {
      translationKey,
      language: opposite,
      ...(kind === 'novel'
        ? { status: { not: 'DRAFT' } }
        : { status: 'PUBLISHED', publishedAt: { lte: new Date() } }),
    },
    select: { slug: true },
  });
  return localePath(
    opposite,
    row
      ? path(row.slug)
      : kind === 'article'
        ? '/articles'
        : kind === 'project'
          ? '/projects'
          : '/works',
  );
}

export async function PublicSite({
  segments = [],
  query = {},
}: {
  segments?: string[];
  query?: Record<string, string | undefined>;
}) {
  const language = segments[0] === 'en' ? 'en' : 'zh';
  const route = language === 'en' ? segments.slice(1) : segments;
  const [section, slug, third, fourth] = route;
  const en = language === 'en';
  const p = (path: string) => localePath(language, path);
  const { site, giscus } = await getSettings();
  const navigation = await db.navigationItem.findMany({
    where: { visible: true },
    orderBy: { order: 'asc' },
  });
  let content: React.ReactNode;
  let translationHref: string | undefined;
  if (!section) {
    const [articles, novels, essays, projects] = await Promise.all([
      publicArticles(language),
      publicNovels(language),
      db.essay.findMany({ where: publicWhere(language), orderBy: { publishedAt: 'desc' } }),
      db.project.findMany({
        where: { ...publicWhere(language), featured: true },
        orderBy: { order: 'asc' },
      }),
    ]);
    const intro = await renderMarkdown(site.bio);
    const research = await renderMarkdown(site.research);
    content = (
      <>
        <section className="introduction">
          <h1>{site.author || site.title}</h1>
          {site.subtitle && <p className="lead">{site.subtitle}</p>}
          {site.bio && <Prose html={intro.html} />}
        </section>
        {(site.email || site.social || site.interests) && (
          <section>
            <h2>{en ? 'Information' : '信息'}</h2>
            <dl className="profile-info">
              {site.interests && (
                <>
                  <dt>{en ? 'Interests' : '技术兴趣'}</dt>
                  <dd>{site.interests}</dd>
                </>
              )}
              {site.email && (
                <>
                  <dt>{en ? 'Email' : '邮箱'}</dt>
                  <dd>
                    <a href={`mailto:${site.email}`}>{site.email}</a>
                  </dd>
                </>
              )}
              {site.social && (
                <>
                  <dt>{en ? 'Elsewhere' : '社交媒体'}</dt>
                  <dd className="pre-wrap">{site.social}</dd>
                </>
              )}
            </dl>
          </section>
        )}
        {site.research && (
          <section>
            <h2>{en ? 'Research' : '研究方向'}</h2>
            <Prose html={research.html} />
          </section>
        )}
        {site.showArticles && (
          <section>
            <div className="section-heading">
              <h2>{en ? 'Recent articles' : '最近文章'}</h2>
              <Link href={p('/articles')}>{en ? 'View all' : '查看全部'} →</Link>
            </div>
            <ContentList
              items={articles.slice(0, site.articleCount)}
              base={p('/articles')}
              language={language}
            />
          </section>
        )}
        {site.showWorks && (
          <section className="literary">
            <div className="section-heading">
              <h2>{en ? 'Literary works' : '文学作品'}</h2>
              <Link href={p('/works')}>{en ? 'View all' : '查看全部'} →</Link>
            </div>
            {novels.length > 0 && (
              <ContentList
                items={novels.slice(0, site.workCount)}
                base={p('/works/novels')}
                language={language}
              />
            )}
            {essays.length > 0 && (
              <ContentList
                items={essays.slice(0, Math.max(0, site.workCount - novels.length))}
                base={p('/works/essays')}
                language={language}
              />
            )}
            {!novels.length && !essays.length && <Empty en={en} />}
          </section>
        )}
        {site.showProjects && (
          <section>
            <div className="section-heading">
              <h2>{en ? 'Projects' : '个人项目'}</h2>
              <Link href={p('/projects')}>{en ? 'View all' : '查看全部'} →</Link>
            </div>
            <ContentList
              items={projects.slice(0, site.projectCount)}
              base={p('/projects')}
              language={language}
            />
          </section>
        )}
      </>
    );
  } else if (section === 'articles' && !slug) {
    let articles = await publicArticles(language);
    if (query.tag) articles = articles.filter((a) => a.tags.some((t) => t.tag.slug === query.tag));
    if (query.category) articles = articles.filter((a) => a.category?.slug === query.category);
    const total = articles.length;
    const page = Math.max(1, Number(query.page) || 1);
    if (query.sort === 'oldest') articles.reverse();
    const [tags, categories] = await Promise.all([
      db.tag.findMany({ where: { articles: { some: { article: publicWhere(language) } } } }),
      db.category.findMany({ where: { articles: { some: publicWhere(language) } } }),
    ]);
    content = (
      <>
        <h1>
          {en ? 'Articles' : '文章'} <small>{total}</small>
        </h1>
        <form className="filter-row">
          <label>
            {en ? 'Tag' : '标签'}
            <select name="tag" defaultValue={query.tag ?? ''}>
              <option value="">{en ? 'All' : '全部'}</option>
              {tags.map((tag) => (
                <option value={tag.slug} key={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {en ? 'Category' : '分类'}
            <select name="category" defaultValue={query.category ?? ''}>
              <option value="">{en ? 'All' : '全部'}</option>
              {categories.map((category) => (
                <option value={category.slug} key={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {en ? 'Sort' : '排序'}
            <select name="sort" defaultValue={query.sort ?? 'newest'}>
              <option value="newest">{en ? 'Newest' : '最新在前'}</option>
              <option value="oldest">{en ? 'Oldest' : '最早在前'}</option>
            </select>
          </label>
          <button className="button button-outline">{en ? 'Filter' : '筛选'}</button>
        </form>
        <ContentList
          items={articles.slice((page - 1) * 10, page * 10)}
          base={p('/articles')}
          language={language}
        />
        <nav className="pagination">
          {Array.from({ length: Math.ceil(total / 10) }, (_, index) => (
            <Link
              aria-current={page === index + 1 ? 'page' : undefined}
              key={index}
              href={`${p('/articles')}?${new URLSearchParams({ ...Object.fromEntries(Object.entries(query).filter((pair): pair is [string, string] => typeof pair[1] === 'string')), page: String(index + 1) })}`}
            >
              {index + 1}
            </Link>
          ))}
        </nav>
      </>
    );
  } else if (section === 'articles' && slug && route.length === 2) {
    const article = await db.article.findFirst({
      where: { ...publicWhere(language), slug },
      include: { tags: { include: { tag: true } } },
    });
    if (!article) notFound();
    translationHref = await translationLink(
      'article',
      article.translationKey,
      language,
      (s) => `/articles/${s}`,
    );
    const markdown = await renderMarkdown(article.content);
    const all = await publicArticles(language);
    const index = all.findIndex((a) => a.id === article.id);
    const related = all
      .filter(
        (a) =>
          a.id !== article.id &&
          a.tags.some((t) => article.tags.some((at) => at.tagId === t.tagId)),
      )
      .slice(0, 3);
    content = (
      <article className="article-detail">
        <header className="article-heading">
          <h1>{article.title}</h1>
          <time>{article.publishedAt?.toISOString().slice(0, 10)}</time>
          {article.description && <p className="lead">{article.description}</p>}
        </header>
        <ReadingTools toc={markdown.toc} />
        {article.cover && (
          <figure>
            <img className="cover" src={article.cover} alt={article.title} />
          </figure>
        )}
        <Prose html={markdown.html} />
        <footer className="article-footer">
          <p>{site.copyright || `© ${site.author || site.title}`}</p>
          <div className="tag-row">
            {article.tags.map(({ tag }) => (
              <Link key={tag.id} href={p(`/tags/${tag.slug}`)}>
                #{tag.name}
              </Link>
            ))}
          </div>
          <div className="chapter-navigation">
            {all[index + 1] && (
              <Link href={p(`/articles/${all[index + 1].slug}`)}>← {all[index + 1].title}</Link>
            )}
            {all[index - 1] && (
              <Link href={p(`/articles/${all[index - 1].slug}`)}>{all[index - 1].title} →</Link>
            )}
          </div>
          {related.length > 0 && (
            <>
              <h2>{en ? 'Related articles' : '相关文章'}</h2>
              <ContentList items={related} base={p('/articles')} language={language} />
            </>
          )}
        </footer>
        <Comments config={giscus} language={language} />
      </article>
    );
  } else if (section === 'archive' && route.length === 1) {
    const articles = await publicArticles(language);
    const years = [...new Set(articles.map((a) => a.publishedAt!.getFullYear()))];
    content = (
      <>
        <h1>{en ? 'Archive' : '归档'}</h1>
        {!years.length && <Empty en={en} />}
        {years.map((year) => (
          <section key={year}>
            <h2>{year}</h2>
            {articles
              .filter((a) => a.publishedAt!.getFullYear() === year)
              .map((a) => (
                <div className="archive-row" key={a.id}>
                  <time>{a.publishedAt?.toISOString().slice(5, 10)}</time>
                  <Link href={p(`/articles/${a.slug}`)}>{a.title}</Link>
                </div>
              ))}
          </section>
        ))}
      </>
    );
  } else if (section === 'tags' && route.length <= 2) {
    const tags = await db.tag.findMany({
      include: {
        _count: {
          select: {
            articles: { where: { article: publicWhere(language) } },
            novels: { where: { novel: { language, status: { not: 'DRAFT' } } } },
            essays: { where: { essay: publicWhere(language) } },
          },
        },
      },
    });
    if (slug) {
      const tag = tags.find((t) => t.slug === slug);
      if (!tag) notFound();
      const [articles, novels, essays] = await Promise.all([
        db.article.findMany({
          where: { ...publicWhere(language), tags: { some: { tagId: tag.id } } },
          orderBy: { publishedAt: 'desc' },
        }),
        db.novel.findMany({
          where: { language, status: { not: 'DRAFT' }, tags: { some: { tagId: tag.id } } },
        }),
        db.essay.findMany({
          where: { ...publicWhere(language), tags: { some: { tagId: tag.id } } },
        }),
      ]);
      content = (
        <>
          <h1>#{tag.name}</h1>
          <p>{tag.description}</p>
          <h2>{en ? 'Articles' : '文章'}</h2>
          <ContentList items={articles} base={p('/articles')} language={language} />
          <h2>{en ? 'Novels' : '小说'}</h2>
          <ContentList items={novels} base={p('/works/novels')} language={language} />
          <h2>{en ? 'Essays' : '散文'}</h2>
          <ContentList items={essays} base={p('/works/essays')} language={language} />
        </>
      );
    } else
      content = (
        <>
          <h1>{en ? 'Tags' : '标签'}</h1>
          <div className="tags-index">
            {tags
              .filter((tag) => tag._count.articles + tag._count.novels + tag._count.essays > 0)
              .map((tag) => (
                <Link key={tag.id} href={p(`/tags/${tag.slug}`)}>
                  #{tag.name}
                  <span>{tag._count.articles + tag._count.novels + tag._count.essays}</span>
                </Link>
              ))}
          </div>
          {!tags.some((t) => t._count.articles + t._count.novels + t._count.essays > 0) && (
            <Empty en={en} />
          )}
        </>
      );
  } else if (section === 'projects' && route.length <= 2) {
    if (slug) {
      const project = await db.project.findFirst({ where: { ...publicWhere(language), slug } });
      if (!project) notFound();
      translationHref = await translationLink(
        'project',
        project.translationKey,
        language,
        (s) => `/projects/${s}`,
      );
      const markdown = await renderMarkdown(project.content);
      content = (
        <>
          <h1>{project.title}</h1>
          <p className="lead">{project.description}</p>
          <div className="tag-row">
            {project.techStack.map((stack) => (
              <span className="badge" key={stack}>
                {stack}
              </span>
            ))}
            <span>{project.projectStatus}</span>
          </div>
          <div className="actions">
            {project.githubUrl && (
              <a href={project.githubUrl} target="_blank" rel="noopener noreferrer">
                GitHub ↗
              </a>
            )}
            {project.demoUrl && (
              <a href={project.demoUrl} target="_blank" rel="noopener noreferrer">
                Demo ↗
              </a>
            )}
          </div>
          {project.cover && <img className="cover" src={project.cover} alt={project.title} />}
          <ReadingTools toc={markdown.toc} />
          <Prose html={markdown.html} />
          {project.screenshots.map((image, index) => (
            <figure key={image}>
              <img className="cover" src={image} alt={`${project.title} ${index + 1}`} />
            </figure>
          ))}
        </>
      );
    } else {
      const projects = await db.project.findMany({
        where: publicWhere(language),
        orderBy: { order: 'asc' },
      });
      content = (
        <>
          <h1>{en ? 'Projects' : '项目'}</h1>
          <ContentList items={projects} base={p('/projects')} language={language} />
        </>
      );
    }
  } else if (section === 'search' && route.length === 1) {
    content = (
      <>
        <h1>{en ? 'Search' : '搜索'}</h1>
        <Search language={language} documents={await searchDocuments(language)} />
      </>
    );
  } else if (section === 'works' && !slug) {
    const [novels, essays] = await Promise.all([
      publicNovels(language),
      db.essay.findMany({ where: publicWhere(language), orderBy: { publishedAt: 'desc' } }),
    ]);
    content = (
      <div className="literary">
        <h1>{en ? 'Literary works' : '文学作品'}</h1>
        <div className="filter-row">
          <Link href="#novels">{en ? 'Novels' : '小说'}</Link>
          <Link href="#essays">{en ? 'Essays' : '散文'}</Link>
        </div>
        <section id="novels">
          <h2>{en ? 'Novels' : '小说'}</h2>
          <div className="bookshelf">
            {novels.map((novel) => (
              <Link className="book" href={p(`/works/novels/${novel.slug}`)} key={novel.id}>
                {novel.cover ? (
                  <img src={novel.cover} alt={novel.title} />
                ) : (
                  <div className="book-cover">
                    <span>{novel.title}</span>
                  </div>
                )}
                <div>
                  <h3>{novel.title}</h3>
                  <p>{novel.description}</p>
                  <span className="muted">
                    {novel.status} · {novel.updatedAt.toISOString().slice(0, 10)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          {!novels.length && <Empty en={en} />}
        </section>
        <section id="essays">
          <h2>{en ? 'Essays' : '散文'}</h2>
          <ContentList items={essays} base={p('/works/essays')} language={language} />
        </section>
      </div>
    );
  } else if (section === 'works' && slug === 'essays' && third && route.length === 3) {
    const essay = await db.essay.findFirst({
      where: { ...publicWhere(language), slug: third },
      include: { tags: { include: { tag: true } } },
    });
    if (!essay) notFound();
    translationHref = await translationLink(
      'essay',
      essay.translationKey,
      language,
      (s) => `/works/essays/${s}`,
    );
    const markdown = await renderMarkdown(essay.content);
    content = (
      <article className="literary essay-detail">
        <header>
          <h1>{essay.title}</h1>
          <time>{essay.publishedAt?.toISOString().slice(0, 10)}</time>
          <p className="lead">{essay.description}</p>
        </header>
        <ReadingTools toc={markdown.toc} />
        {essay.cover && <img className="cover" src={essay.cover} alt={essay.title} />}
        <Prose html={markdown.html} />
        <footer className="article-footer">
          <p>{essay.copyright || site.copyright || `© ${site.author || site.title}`}</p>
          <div className="tag-row">
            {essay.tags.map(({ tag }) => (
              <Link key={tag.id} href={p(`/tags/${tag.slug}`)}>
                #{tag.name}
              </Link>
            ))}
          </div>
        </footer>
        {site.essayComments && essay.commentsEnabled && (
          <Comments config={giscus} language={language} />
        )}
      </article>
    );
  } else if (section === 'works' && slug === 'novels' && third && route.length <= 4) {
    const novel = await db.novel.findFirst({
      where: { slug: third, language, status: { not: 'DRAFT' } },
      include: {
        volumes: { orderBy: { order: 'asc' } },
        chapters: {
          where: { status: 'PUBLISHED', publishedAt: { lte: new Date() } },
          orderBy: chapterOrder,
        },
        tags: { include: { tag: true } },
      },
    });
    if (!novel) notFound();
    translationHref = await translationLink(
      'novel',
      novel.translationKey,
      language,
      (s) => `/works/novels/${s}`,
    );
    const ids = novel.chapters.map((c) => c.id);
    const relations = await db.chapterRelation.findMany({
      where: { sourceChapterId: { in: ids }, targetChapterId: { in: ids } },
    });
    const base = p(`/works/novels/${novel.slug}`);
    if (!fourth) {
      content = (
        <div className="literary">
          <div className="novel-heading">
            {novel.cover && <img src={novel.cover} alt={novel.title} />}
            <div>
              <h1>{novel.title}</h1>
              <span className="badge">{novel.status}</span>
              <p className="lead pre-wrap">{novel.description}</p>
              <div className="tag-row">
                {novel.tags.map(({ tag }) => (
                  <Link key={tag.id} href={p(`/tags/${tag.slug}`)}>
                    #{tag.name}
                  </Link>
                ))}
              </div>
              <div className="actions">
                {novel.chapters[0] && (
                  <Link
                    className="button button-default"
                    href={`${base}/${novel.chapters[0].slug}`}
                  >
                    {en ? 'Start reading' : '开始阅读'}
                  </Link>
                )}
                <ContinueReading novelId={novel.id} base={base} />
              </div>
            </div>
          </div>
          <section>
            <h2>{en ? 'Contents' : '目录'}</h2>
            {[
              ...novel.volumes,
              { id: null, title: en ? 'Other chapters' : '未分卷', description: '' },
            ].map((volume) => {
              const chapters = novel.chapters.filter((c) => c.volumeId === volume.id);
              return chapters.length ? (
                <section className="volume" key={volume.id ?? 'none'}>
                  <h3>{volume.title}</h3>
                  {volume.description && <p>{volume.description}</p>}
                  <ol>
                    {chapters.map((chapter) => (
                      <li key={chapter.id}>
                        <Link href={`${base}/${chapter.slug}`}>{chapter.title}</Link>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null;
            })}
            {!novel.chapters.length && <Empty en={en} />}
          </section>
          <section>
            <h2>{en ? 'Chapter relations' : '章节关系'}</h2>
            <RelationGraph chapters={novel.chapters} relations={relations} base={base} />
          </section>
          {site.novelComments && novel.commentsEnabled && (
            <Comments config={giscus} language={language} />
          )}
        </div>
      );
    } else {
      const chapter = novel.chapters.find((c) => c.slug === fourth);
      if (!chapter) notFound();
      const markdown = await renderMarkdown(chapter.content);
      const index = novel.chapters.findIndex((c) => c.id === chapter.id);
      content = (
        <Reader
          novelId={novel.id}
          chapterId={chapter.id}
          chapterSlug={chapter.slug}
          language={language}
        >
          <article className="literary">
            <Link className="muted" href={base}>
              {novel.title} / {novel.volumes.find((v) => v.id === chapter.volumeId)?.title ?? ''}
            </Link>
            <h1>{chapter.title}</h1>
            <ReadingTools toc={markdown.toc} />
            <Prose html={markdown.html} />
            <div className="chapter-navigation">
              {novel.chapters[index - 1] && (
                <Link href={`${base}/${novel.chapters[index - 1].slug}`}>
                  ← {novel.chapters[index - 1].title}
                </Link>
              )}
              <Link href={base}>{en ? 'Contents' : '目录'}</Link>
              {novel.chapters[index + 1] && (
                <Link href={`${base}/${novel.chapters[index + 1].slug}`}>
                  {novel.chapters[index + 1].title} →
                </Link>
              )}
            </div>
            <details>
              <summary>{en ? 'Chapter directory' : '章节目录'}</summary>
              <ol>
                {novel.chapters.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`${base}/${c.slug}`}
                      aria-current={c.id === chapter.id ? 'page' : undefined}
                    >
                      {c.title}
                    </Link>
                  </li>
                ))}
              </ol>
            </details>
            <section>
              <h2>{en ? 'Related chapters' : '关联章节'}</h2>
              <RelationGraph
                chapters={novel.chapters}
                relations={relations.filter(
                  (r) => r.sourceChapterId === chapter.id || r.targetChapterId === chapter.id,
                )}
                base={base}
              />
            </section>
            {site.novelComments && chapter.commentsEnabled && (
              <Comments config={giscus} language={language} />
            )}
          </article>
        </Reader>
      );
    }
  } else if (route.length === 1) {
    const page = await db.page.findFirst({ where: { ...publicWhere(language), slug: section } });
    if (!page && !['about', 'privacy', 'copyright'].includes(section)) notFound();
    const markdown = await renderMarkdown(page?.content ?? '');
    content = (
      <>
        <h1>{page?.title ?? (en ? 'About' : '关于')}</h1>
        {page ? (
          <>
            <ReadingTools toc={markdown.toc} />
            <Prose html={markdown.html} />
          </>
        ) : (
          <Empty en={en} />
        )}
      </>
    );
  } else notFound();
  return (
    <div lang={en ? 'en' : 'zh-CN'} className="public-shell">
      <Header
        title={site.title}
        logo={site.logo}
        items={navigation}
        language={language}
        translationHref={translationHref}
      />
      <main
        id="main-content"
        className="public-main"
        data-section={section ?? 'home'}
        data-detail={Boolean(slug)}
      >
        {content}
      </main>
      <footer className="site-footer">
        <span>
          © {new Date().getFullYear()} {site.author || site.title}
        </span>
        <div>
          <Link href={p('/feed.xml')}>RSS</Link>
          <Link href={p('/privacy')}>{en ? 'Privacy' : '隐私'}</Link>
          <Link href="/admin">{en ? 'Admin' : '管理'}</Link>
        </div>
      </footer>
    </div>
  );
}
