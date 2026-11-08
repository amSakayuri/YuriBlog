'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import type { SiteConfig, GiscusConfig } from '@/lib/settings';
const labels: Record<string, string> = {
  title: '网站名称',
  subtitle: '副标题',
  domain: '网站域名（含 https://）',
  author: '作者名称',
  bio: '首页介绍（Markdown）',
  email: '联系邮箱',
  social: '社交媒体（文本 / 链接）',
  interests: '技术兴趣',
  research: '研究方向（Markdown）',
  logo: 'Logo URL',
  favicon: 'Favicon URL',
  defaultLanguage: '默认语言',
  defaultTheme: '默认主题',
  description: '默认 SEO 描述',
  ogImage: '默认 Open Graph 图片',
  showArticles: '首页显示文章',
  showWorks: '首页显示文学作品',
  showProjects: '首页显示项目',
  articleCount: '首页文章数量',
  workCount: '首页作品数量',
  projectCount: '首页项目数量',
  essayComments: '允许散文评论',
  novelComments: '允许小说与章节评论',
  copyright: '默认版权信息',
  feedTitle: 'RSS 标题',
  feedDescription: 'RSS 描述',
  feedCount: 'RSS 文章数量',
  enabled: '启用 Giscus',
  repo: 'GitHub Repository（owner/repo）',
  repoId: 'Repository ID',
  category: 'Discussion Category',
  categoryId: 'Category ID',
  mapping: '映射方式',
  reactionsEnabled: '开启 Reactions',
  inputPosition: '输入框位置',
  theme: 'Giscus 主题（auto 随网站变化）',
  lang: '默认评论语言',
};
const choices: Record<string, string[]> = {
  defaultLanguage: ['zh', 'en'],
  defaultTheme: ['system', 'light', 'dark'],
  mapping: ['pathname'],
  inputPosition: ['bottom', 'top'],
  theme: ['auto', 'light', 'dark', 'preferred_color_scheme', 'transparent_dark'],
  lang: ['zh-CN', 'en'],
};
export function SettingsEditor({
  initial,
  section,
}: {
  initial: { site: SiteConfig; giscus: GiscusConfig };
  section: 'site' | 'giscus';
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = useForm<Record<string, unknown>>({ defaultValues: initial[section] });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const repo = String(watch('repo') ?? '');
  return (
    <>
      <h1>{section === 'site' ? '网站设置' : 'Giscus 评论设置'}</h1>
      <p className="muted">
        {section === 'site'
          ? '个人信息可以留空。保存后立即生效。'
          : '评论由 GitHub Discussions 保存与管理。此处仅配置公开初始化参数，不填写 GitHub Token。'}
      </p>
      <form
        className="settings-form"
        onSubmit={handleSubmit(async (values) => {
          setError('');
          setMessage('');
          try {
            const result = await fetch('/api/admin/settings', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...initial, [section]: values }),
            });
            const data = await result.json();
            if (!result.ok) throw new Error(data.error);
            setMessage('设置已保存');
          } catch (error) {
            setError((error as Error).message);
          }
        })}
      >
        {Object.entries(initial[section]).map(([key, value]) =>
          typeof value === 'boolean' ? (
            <label className="checkbox-label" key={key}>
              <input type="checkbox" {...register(key)} />
              {labels[key] ?? key}
            </label>
          ) : (
            <label key={key}>
              {labels[key] ?? key}
              {choices[key] ? (
                <select {...register(key)}>
                  {choices[key].map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              ) : [
                  'bio',
                  'research',
                  'description',
                  'social',
                  'copyright',
                  'feedDescription',
                ].includes(key) ? (
                <textarea rows={key === 'bio' || key === 'research' ? 7 : 3} {...register(key)} />
              ) : (
                <input
                  type={typeof value === 'number' ? 'number' : 'text'}
                  min={typeof value === 'number' ? 1 : undefined}
                  {...register(key, {
                    ...(typeof value === 'number' ? { valueAsNumber: true } : {}),
                  })}
                />
              )}
            </label>
          ),
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="success">
            {message}
          </p>
        )}
        <Button disabled={isSubmitting}>{isSubmitting ? '正在保存…' : '保存设置'}</Button>
        {section === 'giscus' && /^[\w.-]+\/[\w.-]+$/.test(repo) && (
          <a
            className="button button-outline"
            href={`https://github.com/${repo}/discussions`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open GitHub Discussions ↗
          </a>
        )}
      </form>
    </>
  );
}
