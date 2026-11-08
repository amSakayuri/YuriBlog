import { parseDocument } from 'yaml';
import { z } from 'zod';
import { db } from './db';
import { schemas } from './validation';
import { HttpError } from './auth';
import type { PrismaClient } from '@prisma/client';
export const contentSlug = (value: string) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 190);
export async function importMarkdown(file: File, actorId: string, store: PrismaClient = db) {
  if (!/\.(md|markdown)$/i.test(file.name) || file.size < 1 || file.size > 2_000_000)
    throw new HttpError(400, '请选择不超过2MB的.md或.markdown文件');
  let source: string;
  try {
    source = new TextDecoder('utf-8', { fatal: true })
      .decode(await file.arrayBuffer())
      .replace(/^\uFEFF/, '')
      .replace(/\r\n/g, '\n');
  } catch {
    throw new HttpError(400, '文件必须使用UTF-8编码');
  }
  if (source.includes('\0')) throw new HttpError(400, '文件不是有效Markdown文本');
  let metadata: Record<string, unknown> = {};
  const match = source.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (match) {
    const document = parseDocument(match[1], { uniqueKeys: true });
    if (document.errors.length) throw new HttpError(400, 'Front matter格式有误');
    try {
      metadata = z.record(z.string(), z.unknown()).parse(document.toJS({ maxAliasCount: 0 }));
    } catch {
      throw new HttpError(400, 'Front matter必须为简单键值，不支持别名');
    }
    source = source.slice(match[0].length);
  }
  const stem = file.name.replace(/\.(md|markdown)$/i, '');
  const fallback = source.match(/^#\s+(.+)$/m)?.[1]?.trim() || stem;
  const input = schemas.articles.parse({
    ...metadata,
    title: metadata.title ?? fallback,
    slug: metadata.slug ?? (contentSlug(stem) || `article-${Date.now()}`),
    content: source,
    status: 'DRAFT',
    tagIds: [],
    categoryId: null,
  });
  const tags = z
    .array(z.string().trim().min(1).max(100))
    .max(50)
    .parse(metadata.tags ?? []);
  const category = z.string().trim().max(100).optional().parse(metadata.category);
  if (category && !contentSlug(category)) throw new HttpError(400, '分类名称无效');
  return store.$transaction(async (tx) => {
    const tagIds = [];
    for (const name of new Set(tags)) {
      const slug = contentSlug(name);
      if (!slug) throw new HttpError(400, '标签名称无效');
      const tag = await tx.tag.upsert({ where: { slug }, create: { name, slug }, update: {} });
      tagIds.push(tag.id);
    }
    const group = category
      ? await tx.category.upsert({
          where: { slug: contentSlug(category) },
          create: { name: category, slug: contentSlug(category) },
          update: {},
        })
      : null;
    const { tagIds: unused, ...data } = input;
    void unused;
    const article = await tx.article.create({
      data: {
        ...data,
        categoryId: group?.id ?? null,
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        action: 'IMPORT_MARKDOWN',
        resource: 'articles',
        targetId: article.id,
        result: 'SUCCESS',
      },
    });
    return article;
  });
}
