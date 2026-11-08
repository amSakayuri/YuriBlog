import type { Resource } from '@/lib/validation';
export type Field = {
  key: string;
  label: string;
  type?:
    | 'text'
    | 'textarea'
    | 'markdown'
    | 'number'
    | 'boolean'
    | 'select'
    | 'datetime'
    | 'list'
    | 'tags';
  options?: string[];
  required?: boolean;
};
const title: Field = { key: 'title', label: '标题', required: true };
const slug: Field = { key: 'slug', label: 'Slug / 稳定地址', required: true };
const description: Field = { key: 'description', label: '摘要 / 简介', type: 'textarea' };
const content: Field = { key: 'content', label: 'Markdown 正文', type: 'markdown' };
const cover: Field = { key: 'cover', label: '封面 URL' };
const language: Field = { key: 'language', label: '语言', type: 'select', options: ['zh', 'en'] };
const translation: Field = { key: 'translationKey', label: '翻译关联 Key（两种语言填写相同值）' };
const status: Field = {
  key: 'status',
  label: '发布状态',
  type: 'select',
  options: ['DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED'],
};
const published: Field = { key: 'publishedAt', label: '发布时间（本地时区）', type: 'datetime' };
const order: Field = { key: 'order', label: '顺序（较小在前）', type: 'number' };
const tags: Field = { key: 'tagIds', label: '标签', type: 'tags' };
const comments: Field = {
  key: 'commentsEnabled',
  label: '启用 Giscus（还需网站总开关）',
  type: 'boolean',
};
const seo: Field[] = [
  { key: 'seoTitle', label: 'SEO 标题' },
  { key: 'seoDescription', label: 'SEO 描述', type: 'textarea' },
  { key: 'ogImage', label: 'Open Graph 图片 URL' },
];
export const fields: Record<Resource, Field[]> = {
  articles: [
    title,
    slug,
    description,
    cover,
    content,
    tags,
    { key: 'categoryId', label: '分类', type: 'select' },
    language,
    translation,
    status,
    published,
    ...seo,
  ],
  essays: [
    title,
    slug,
    description,
    cover,
    content,
    tags,
    language,
    translation,
    status,
    published,
    ...seo,
    { key: 'copyright', label: '版权信息' },
    comments,
  ],
  novels: [
    title,
    slug,
    description,
    cover,
    language,
    translation,
    {
      key: 'status',
      label: '创作状态',
      type: 'select',
      options: ['DRAFT', 'ONGOING', 'COMPLETED', 'HIATUS'],
    },
    tags,
    comments,
  ],
  projects: [
    title,
    slug,
    description,
    cover,
    content,
    language,
    translation,
    { key: 'category', label: '项目分类' },
    { key: 'techStack', label: '技术栈（每行一个）', type: 'list' },
    { key: 'screenshots', label: '截图 URL（每行一个）', type: 'list' },
    { key: 'githubUrl', label: 'GitHub URL' },
    { key: 'demoUrl', label: 'Demo URL' },
    { key: 'projectStatus', label: '项目进展' },
    status,
    published,
    order,
    { key: 'featured', label: '在首页展示', type: 'boolean' },
  ],
  volumes: [
    { key: 'novelId', label: '所属小说', type: 'select', required: true },
    title,
    description,
    order,
  ],
  chapters: [
    { key: 'novelId', label: '所属小说', type: 'select', required: true },
    { key: 'volumeId', label: '所属卷', type: 'select' },
    title,
    slug,
    { key: 'summary', label: '章节摘要', type: 'textarea' },
    content,
    order,
    status,
    published,
    comments,
  ],
  relations: [
    { key: 'novelId', label: '所属小说', type: 'select', required: true },
    { key: 'sourceChapterId', label: '起始章节', type: 'select', required: true },
    { key: 'targetChapterId', label: '目标章节', type: 'select', required: true },
    {
      key: 'type',
      label: '关系类型',
      type: 'select',
      options: [
        'RELATED',
        'REFERENCE',
        'FORESHADOWING',
        'PAYOFF',
        'SAME_ARC',
        'PARALLEL',
        'FLASHBACK',
        'ALTERNATE_PERSPECTIVE',
      ],
    },
    { key: 'label', label: '关系名称' },
    description,
  ],
  tags: [
    { key: 'name', label: '标签名称', required: true },
    slug,
    description,
    { key: 'color', label: '颜色（#RRGGBB，可空）' },
  ],
  categories: [{ key: 'name', label: '分类名称', required: true }, slug, description],
  pages: [title, slug, content, language, status, published],
  navigation: [
    title,
    { key: 'titleEn', label: '英文名称' },
    { key: 'href', label: '链接', required: true },
    { key: 'external', label: '外部链接', type: 'boolean' },
    { key: 'visible', label: '显示', type: 'boolean' },
    order,
  ],
};
