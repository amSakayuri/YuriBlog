import { z } from 'zod';
import { db } from './db';
import { cache } from 'react';

const webUrl = z
  .string()
  .max(2000)
  .refine((v) => !v || /^https?:\/\//.test(v), '请输入 HTTP(S) URL');
export const siteSchema = z.object({
  title: z.string().min(1).max(100).default('Yuri Blog'),
  subtitle: z.string().max(300).default(''),
  domain: webUrl.default(''),
  author: z.string().max(100).default(''),
  bio: z.string().max(5000).default(''),
  email: z.union([z.literal(''), z.email()]).default(''),
  social: z.string().max(2000).default(''),
  interests: z.string().max(2000).default(''),
  research: z.string().max(5000).default(''),
  logo: webUrl.or(z.string().regex(/^\/uploads\//)).default(''),
  favicon: webUrl.or(z.string().regex(/^\/uploads\//)).default(''),
  defaultLanguage: z.enum(['zh', 'en']).default('zh'),
  defaultTheme: z.enum(['light', 'dark', 'system']).default('system'),
  description: z.string().max(500).default(''),
  ogImage: webUrl.or(z.string().regex(/^\/uploads\//)).default(''),
  showArticles: z.boolean().default(true),
  showWorks: z.boolean().default(true),
  showProjects: z.boolean().default(true),
  articleCount: z.number().int().min(1).max(30).default(5),
  workCount: z.number().int().min(1).max(30).default(4),
  projectCount: z.number().int().min(1).max(30).default(3),
  essayComments: z.boolean().default(false),
  novelComments: z.boolean().default(false),
  copyright: z.string().max(1000).default(''),
  feedTitle: z.string().max(100).default('Yuri Blog'),
  feedDescription: z.string().max(500).default(''),
  feedCount: z.number().int().min(1).max(100).default(20),
});
export const giscusSchema = z
  .object({
    enabled: z.boolean().default(false),
    repo: z
      .string()
      .regex(/^$|^[\w.-]+\/[\w.-]+$/)
      .default(''),
    repoId: z.string().max(100).default(''),
    category: z.string().max(100).default(''),
    categoryId: z.string().max(100).default(''),
    mapping: z.literal('pathname').default('pathname'),
    reactionsEnabled: z.boolean().default(true),
    inputPosition: z.enum(['top', 'bottom']).default('bottom'),
    theme: z
      .enum(['auto', 'light', 'dark', 'preferred_color_scheme', 'transparent_dark'])
      .default('auto'),
    lang: z.enum(['zh-CN', 'en']).default('zh-CN'),
  })
  .superRefine((v, c) => {
    if (v.enabled && (!v.repo || !v.repoId || !v.category || !v.categoryId))
      c.addIssue({ code: 'custom', message: '启用评论前请填写完整仓库与分类配置' });
  });
export type SiteConfig = z.infer<typeof siteSchema>;
export type GiscusConfig = z.infer<typeof giscusSchema>;
export const getSettings = cache(async function getSettings() {
  const values = await db.siteSetting.findMany();
  return {
    site: siteSchema.parse(values.find((v) => v.key === 'site')?.value ?? {}),
    giscus: giscusSchema.parse(values.find((v) => v.key === 'giscus')?.value ?? {}),
  };
});
