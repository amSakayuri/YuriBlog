import { z } from 'zod';
const text = z.string().max(2000000);
const title = z.string().trim().min(1, '请输入标题').max(300);
const slug = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u, 'Slug 仅允许字母、数字、下划线和短横线');
const asset = z
  .string()
  .max(2000)
  .refine(
    (v) => !v || /^\/uploads\/[a-zA-Z0-9._-]+$/.test(v) || /^https?:\/\//.test(v),
    '无效图片路径',
  );
const url = z
  .string()
  .max(2000)
  .refine((v) => !v || /^https?:\/\//.test(v), '无效 URL');
export const status = z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED']);
const common = {
  title,
  slug,
  description: z.string().max(5000).default(''),
  content: text.default(''),
  cover: asset.default(''),
  language: z.enum(['zh', 'en']).default('zh'),
  translationKey: z.string().max(100).nullable().default(null),
  status: status.default('DRAFT'),
  publishedAt: z.string().datetime().nullable().default(null),
};
const seo = {
  seoTitle: z.string().max(300).default(''),
  seoDescription: z.string().max(1000).default(''),
  ogImage: asset.default(''),
};
export const schemas = {
  articles: z.object({
    ...common,
    ...seo,
    categoryId: z.string().nullable().default(null),
    tagIds: z.array(z.string()).max(50).default([]),
  }),
  essays: z.object({
    ...common,
    ...seo,
    copyright: z.string().max(1000).default(''),
    commentsEnabled: z.boolean().default(false),
    tagIds: z.array(z.string()).max(50).default([]),
  }),
  novels: z.object({
    title,
    slug,
    description: z.string().max(10000).default(''),
    cover: asset.default(''),
    language: z.enum(['zh', 'en']).default('zh'),
    translationKey: z.string().max(100).nullable().default(null),
    status: z.enum(['DRAFT', 'ONGOING', 'COMPLETED', 'HIATUS']).default('DRAFT'),
    commentsEnabled: z.boolean().default(false),
    tagIds: z.array(z.string()).max(50).default([]),
  }),
  volumes: z.object({
    novelId: z.string().min(1),
    title,
    description: z.string().max(5000).default(''),
    order: z.number().int().min(0).default(0),
  }),
  chapters: z.object({
    novelId: z.string().min(1),
    volumeId: z.string().nullable().default(null),
    title,
    slug,
    summary: z.string().max(5000).default(''),
    content: text.default(''),
    order: z.number().int().min(0).default(0),
    status: status.default('DRAFT'),
    publishedAt: z.string().datetime().nullable().default(null),
    commentsEnabled: z.boolean().default(false),
  }),
  relations: z
    .object({
      novelId: z.string().min(1),
      sourceChapterId: z.string().min(1),
      targetChapterId: z.string().min(1),
      type: z.enum([
        'RELATED',
        'REFERENCE',
        'FORESHADOWING',
        'PAYOFF',
        'SAME_ARC',
        'PARALLEL',
        'FLASHBACK',
        'ALTERNATE_PERSPECTIVE',
      ]),
      label: z.string().max(200).default(''),
      description: z.string().max(2000).default(''),
    })
    .refine((v) => v.sourceChapterId !== v.targetChapterId, '不能关联章节自身'),
  projects: z.object({
    ...common,
    category: z.string().max(100).default(''),
    techStack: z.array(z.string().max(100)).max(50).default([]),
    screenshots: z.array(asset).max(50).default([]),
    githubUrl: url.default(''),
    demoUrl: url.default(''),
    projectStatus: z.string().max(100).default(''),
    order: z.number().int().min(0).default(0),
    featured: z.boolean().default(false),
  }),
  tags: z.object({
    name: title,
    slug,
    description: z.string().max(5000).default(''),
    color: z
      .string()
      .regex(/^$|^#[a-fA-F0-9]{6}$/)
      .default(''),
  }),
  categories: z.object({ name: title, slug, description: z.string().max(5000).default('') }),
  pages: z.object({
    title,
    slug,
    content: text.default(''),
    language: z.enum(['zh', 'en']).default('zh'),
    status: status.default('DRAFT'),
    publishedAt: z.string().datetime().nullable().default(null),
  }),
  navigation: z.object({
    title,
    titleEn: z.string().max(100).default(''),
    href: z
      .string()
      .max(2000)
      .refine(
        (v) => /^\/(?!\/)/.test(v) || /^https?:\/\//.test(v),
        '仅允许站内路径或 HTTP(S) 链接',
      ),
    external: z.boolean().default(false),
    visible: z.boolean().default(true),
    order: z.number().int().min(0).default(0),
  }),
};
export type Resource = keyof typeof schemas;
export const resourceNames: Record<Resource, string> = {
  articles: '文章',
  novels: '小说',
  essays: '散文',
  projects: '项目',
  volumes: '卷',
  chapters: '章节',
  relations: '章节关系',
  tags: '标签',
  categories: '分类',
  pages: '页面',
  navigation: '导航',
};
