import { Prisma, type Role, type PrismaClient } from '@prisma/client';
import { db } from './db';
import { schemas, type Resource } from './validation';
import { HttpError } from './auth';

export const published = { status: 'PUBLISHED' as const, publishedAt: { lte: new Date() } };
export function publicWhere(language: string) {
  return { status: 'PUBLISHED' as const, publishedAt: { lte: new Date() }, language };
}
// This explicit map restricts the generic CMS endpoint to approved content tables.
export function delegate(tx: Prisma.TransactionClient, resource: Resource) {
  const map = {
    articles: tx.article,
    novels: tx.novel,
    essays: tx.essay,
    projects: tx.project,
    volumes: tx.novelVolume,
    chapters: tx.novelChapter,
    relations: tx.chapterRelation,
    tags: tx.tag,
    categories: tx.category,
    pages: tx.page,
    navigation: tx.navigationItem,
  };
  return map[resource] as unknown as {
    findMany(args?: Record<string, unknown>): Promise<Record<string, unknown>[]>;
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    delete(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
}
export function canManage(role: Role, resource: string) {
  return (
    role !== 'EDITOR' ||
    [
      'articles',
      'novels',
      'essays',
      'projects',
      'chapters',
      'volumes',
      'relations',
      'media',
      'tags',
      'categories',
      'pages',
    ].includes(resource)
  );
}
export async function listContent(resource: Resource, query: string = '', novelId?: string) {
  const tagged = ['articles', 'essays', 'novels'].includes(resource);
  const rows = await delegate(db, resource).findMany({
    ...(tagged ? { include: { tags: true } } : {}),
    ...(resource === 'tags'
      ? { include: { _count: { select: { articles: true, novels: true, essays: true } } } }
      : resource === 'categories'
        ? { include: { _count: { select: { articles: true } } } }
        : {}),
    ...(['chapters', 'volumes', 'relations'].includes(resource) && novelId
      ? { where: { novelId } }
      : {}),
    orderBy: ['chapters', 'volumes', 'navigation', 'projects'].includes(resource)
      ? { order: 'asc' }
      : resource === 'relations'
        ? { id: 'asc' }
        : ['tags', 'categories'].includes(resource)
          ? { name: 'asc' }
          : { updatedAt: 'desc' },
  });
  return rows
    .filter(
      (r) =>
        !query ||
        String(r.title ?? r.name ?? '')
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .map((r) => ({
      ...r,
      ...(tagged ? { tagIds: (r.tags as { tagId: string }[]).map((t) => t.tagId) } : {}),
    }));
}
export async function writeContent(
  resource: Resource,
  input: unknown,
  actorId: string,
  id?: string,
  store: PrismaClient = db,
) {
  const parsed = schemas[resource].parse(input);
  const data: Record<string, unknown> = { ...parsed };
  const tagIds = data.tagIds as string[] | undefined;
  delete data.tagIds;
  if (data.translationKey === '') data.translationKey = null;
  if ('status' in data && resource !== 'novels') {
    if (data.status === 'PUBLISHED' && !data.publishedAt)
      data.publishedAt = new Date().toISOString();
    if (
      data.status === 'SCHEDULED' &&
      (!data.publishedAt || new Date(String(data.publishedAt)) <= new Date())
    )
      throw new HttpError(400, '定时发布需要未来的发布时间');
    if (data.status === 'PUBLISHED' && new Date(String(data.publishedAt)) > new Date())
      throw new HttpError(400, '未来内容请使用定时发布');
  }
  if (tagIds)
    data.tags = {
      ...(id ? { deleteMany: {} } : {}),
      create: [...new Set(tagIds)].map((tagId) => ({ tagId })),
    };
  return store.$transaction(async (tx) => {
    const previous = id ? await delegate(tx, resource).findUnique({ where: { id } }) : null;
    const record = id
      ? await delegate(tx, resource).update({ where: { id }, data })
      : await delegate(tx, resource).create({ data });
    await tx.auditLog.create({
      data: {
        actorId,
        action: !id
          ? 'CREATE'
          : previous?.status !== record.status && record.status === 'PUBLISHED'
            ? 'PUBLISH'
            : previous?.status === 'PUBLISHED' && record.status !== 'PUBLISHED'
              ? 'UNPUBLISH'
              : record.status === 'SCHEDULED' && previous?.status !== 'SCHEDULED'
                ? 'SCHEDULE'
                : 'UPDATE',
        resource,
        targetId: String(record.id),
        result: 'SUCCESS',
      },
    });
    return tagIds ? { ...record, tagIds: [...new Set(tagIds)] } : record;
  });
}
export async function removeContent(resource: Resource, id: string, actorId: string) {
  return db.$transaction(async (tx) => {
    if (resource === 'volumes')
      await tx.novelChapter.updateMany({ where: { volumeId: id }, data: { volumeId: null } });
    await delegate(tx, resource).delete({ where: { id } });
    await tx.auditLog.create({
      data: { actorId, action: 'DELETE', resource, targetId: id, result: 'SUCCESS' },
    });
  });
}
export async function publishDue() {
  return db.$transaction(async (tx) => {
    let count = 0;
    for (const resource of ['article', 'essay', 'novelChapter', 'project', 'page'] as const) {
      const table = tx[resource] as unknown as {
        updateMany(args: unknown): Promise<{ count: number }>;
      };
      const result = await table.updateMany({
        where: { status: 'SCHEDULED', publishedAt: { lte: new Date() } },
        data: { status: 'PUBLISHED' },
      });
      count += result.count;
    }
    if (count)
      await tx.auditLog.create({
        data: { action: 'SCHEDULE_PUBLISH', resource: 'content', result: `SUCCESS:${count}` },
      });
    await tx.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await tx.loginAttempt.deleteMany({ where: { resetAt: { lt: new Date() } } });
    return count;
  });
}
