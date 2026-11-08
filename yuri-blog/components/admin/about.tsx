'use client';
import { useEffect, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

type Page = {
  title: string;
  content: string;
  language: string;
  status: string;
  publishedAt: string | null;
};
function blank(language: string): Page {
  const en = language === 'en';
  return {
    language,
    title: en ? 'About' : '关于',
    status: 'DRAFT',
    publishedAt: null,
    content: en
      ? '## About me\n\n\n## About this site\n\nThis site is built with Next.js, React, TypeScript and Tailwind CSS. Content is stored in PostgreSQL through Prisma, and comments use Giscus / GitHub Discussions.\n'
      : '## 关于我\n\n\n## 关于本站\n\n本站使用 Next.js、React、TypeScript 和 Tailwind CSS 构建，通过 Prisma 将内容保存在 PostgreSQL 中，评论使用 Giscus / GitHub Discussions。\n',
  };
}
export function AboutEditor({ initial }: { initial: Page[] }) {
  const [pages, setPages] = useState(initial);
  const [form, setForm] = useState<Page>(
    () => initial.find((p) => p.language === 'zh') ?? blank('zh'),
  );
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const navigate = (event: MouseEvent) => {
      const link = (event.target as Element).closest('a[href]') as HTMLAnchorElement | null;
      if (
        link &&
        link.target !== '_blank' &&
        new URL(link.href).pathname !== location.pathname &&
        !confirm('有未保存的修改，确定离开？')
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    addEventListener('beforeunload', warn);
    document.addEventListener('click', navigate, true);
    return () => {
      removeEventListener('beforeunload', warn);
      document.removeEventListener('click', navigate, true);
    };
  }, [dirty]);
  function update(patch: Partial<Page>) {
    setForm((value) => ({ ...value, ...patch }));
    setDirty(true);
    setMessage('');
    setPreview('');
  }
  return (
    <>
      <h1>关于页面</h1>
      <p className="muted">
        编辑作者自我介绍和本站技术栈。个人介绍请自行填写；保存并发布后在前台显示。
      </p>
      <div className="tabs">
        {['zh', 'en'].map((language) => (
          <Button
            key={language}
            variant={form.language === language ? 'default' : 'outline'}
            onClick={() => {
              if (dirty && !confirm('切换语言会放弃未保存的修改，是否继续？')) return;
              setForm(pages.find((p) => p.language === language) ?? blank(language));
              setDirty(false);
              setPreview('');
              setMessage('');
              setError('');
            }}
          >
            {language === 'zh' ? '中文' : 'English'}
          </Button>
        ))}
        <a
          className="button button-outline"
          href={form.language === 'en' ? '/en/about' : '/about'}
          target="_blank"
          rel="noopener noreferrer"
        >
          查看已发布页面
        </a>
      </div>
      <form
        className="editor-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          setMessage('');
          try {
            const response = await fetch('/api/admin/about', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(form),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setPages((value) => [...value.filter((p) => p.language !== form.language), data]);
            setForm(data);
            setDirty(false);
            setMessage(data.status === 'PUBLISHED' ? '关于页面已发布' : '草稿已保存');
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          页面标题
          <input
            value={form.title}
            required
            maxLength={300}
            onChange={(e) => update({ title: e.target.value })}
          />
        </label>
        <label>
          发布状态
          <select value={form.status} onChange={(e) => update({ status: e.target.value })}>
            <option value="DRAFT">草稿</option>
            <option value="PUBLISHED">已发布</option>
            <option value="ARCHIVED">归档</option>
          </select>
        </label>
        <div>
          <p id="about-content-label">正文（Markdown）</p>
          <CodeMirror
            aria-labelledby="about-content-label"
            value={form.content}
            extensions={[markdown()]}
            theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
            minHeight="360px"
            onChange={(content) => update({ content })}
          />
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="success" role="status">
            {message}
          </p>
        )}
        <div className="actions">
          <Button disabled={busy}>{busy ? '正在保存…' : '保存'}</Button>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              setError('');
              try {
                const response = await fetch('/api/markdown', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ content: form.content }),
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error);
                setPreview(data.html);
              } catch (error) {
                setError((error as Error).message);
              }
            }}
          >
            预览正文
          </Button>
        </div>
      </form>
      {preview && (
        <section
          aria-label="正文预览"
          className="prose"
          dangerouslySetInnerHTML={{ __html: preview }}
        />
      )}
    </>
  );
}
