import { createHash } from 'node:crypto';
import { lstat, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { delegate } from './content';
import { schemas, type Resource } from './validation';
import { siteSchema, giscusSchema } from './settings';
import { uploadsDirectory, uploadPath } from './media';

export const syncResources = [
  'tags',
  'categories',
  'novels',
  'volumes',
  'chapters',
  'relations',
  'articles',
  'essays',
  'projects',
  'pages',
  'navigation',
] as const satisfies readonly Resource[];
type Store = Prisma.TransactionClient | PrismaClient;
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const stamp = z.string().datetime();
const documentSchema = z.object({
  id,
  data: z.record(z.string(), z.unknown()),
  createdAt: stamp.optional(),
  updatedAt: stamp.optional(),
});
const imagePath = z.string().regex(/^\/uploads\/[a-zA-Z0-9_-]+\.(webp|gif)$/);
const mediaSchema = z.object({
  id,
  filename: z.string().max(255),
  mimeType: z.enum(['image/webp', 'image/gif']),
  size: z.number().int().min(1).max(10485760),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  storagePath: imagePath,
  thumbnailPath: imagePath,
  alt: z.string().max(5000),
  createdAt: stamp,
});
const manifestSchema = z.object({
  version: z.literal(1),
  resources: z.record(z.string(), z.array(documentSchema).max(10000)),
  media: z.array(mediaSchema).max(10000),
  assets: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)),
  settings: z.object({ site: siteSchema, giscus: giscusSchema }),
});
export type Snapshot = z.infer<typeof manifestSchema>;
export const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export const snapshotHash = (snapshot: Snapshot) => digest(JSON.stringify(snapshot));
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export async function captureSnapshot(store: Store): Promise<Snapshot> {
  const resources: Snapshot['resources'] = {};
  const joins = {
    articles: await store.articleTag.findMany(),
    novels: await store.novelTag.findMany(),
    essays: await store.essayTag.findMany(),
  };
  for (const resource of syncResources) {
    const rows = json(await delegate(store, resource).findMany({ orderBy: { id: 'asc' } }));
    resources[resource] = rows.map((row) => {
      const tagIds =
        resource === 'articles'
          ? joins.articles.filter((t) => t.articleId === row.id).map((t) => t.tagId)
          : resource === 'novels'
            ? joins.novels.filter((t) => t.novelId === row.id).map((t) => t.tagId)
            : resource === 'essays'
              ? joins.essays.filter((t) => t.essayId === row.id).map((t) => t.tagId)
              : undefined;
      const data = schemas[resource].parse({
        ...row,
        ...(tagIds ? { tagIds: tagIds.sort() } : {}),
      });
      return documentSchema.parse({
        id: row.id,
        data,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      });
    });
  }
  const media = json(await store.mediaAsset.findMany({ orderBy: { id: 'asc' } }));
  const assets: Record<string, string> = {};
  for (const item of media)
    for (const url of [item.storagePath, item.thumbnailPath]) {
      const name = url.split('/').pop()!;
      assets[name] = digest(await readFile(uploadPath(name)));
    }
  const settings = await store.siteSetting.findMany({ where: { key: { in: ['site', 'giscus'] } } });
  return manifestSchema.parse({
    version: 1,
    resources,
    media,
    assets: Object.fromEntries(Object.entries(assets).sort(([a], [b]) => a.localeCompare(b))),
    settings: {
      site: siteSchema.parse(settings.find((s) => s.key === 'site')?.value ?? {}),
      giscus: giscusSchema.parse(settings.find((s) => s.key === 'giscus')?.value ?? {}),
    },
  });
}

async function safeRead(root: string, relative: string, limit = 2_100_000) {
  const parts = relative.split('/');
  if (parts.some((p) => !p || p === '.' || p === '..' || p.includes('\\')))
    throw new Error('仓库文件路径无效');
  let file = root;
  for (const part of parts) {
    file = path.join(/* turbopackIgnore: true */ file, part);
    if ((await lstat(file)).isSymbolicLink()) throw new Error('不支持符号链接资源');
  }
  const info = await lstat(file);
  if (!info.isFile() || info.size > limit) throw new Error('仓库文件大小或类型无效');
  return readFile(file);
}

export async function writeSnapshot(root: string, snapshot: Snapshot) {
  await mkdir(root, { recursive: true });
  const manifest = structuredClone(snapshot);
  for (const resource of syncResources) {
    await mkdir(path.join(/* turbopackIgnore: true */ root, resource), { recursive: true });
    for (const row of manifest.resources[resource]) {
      if (typeof row.data.content === 'string') {
        await writeFile(
          path.join(/* turbopackIgnore: true */ root, resource, `${row.id}.md`),
          row.data.content,
        );
        delete row.data.content;
      }
    }
  }
  await mkdir(path.join(/* turbopackIgnore: true */ root, 'assets'), { recursive: true });
  for (const name of Object.keys(snapshot.assets))
    await writeFile(
      path.join(/* turbopackIgnore: true */ root, 'assets', name),
      await readFile(uploadPath(name)),
    );
  await writeFile(
    path.join(/* turbopackIgnore: true */ root, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
}

export async function readSnapshot(root: string): Promise<Snapshot> {
  if ((await lstat(root)).isSymbolicLink()) throw new Error('资源目录不能为符号链接');
  const snapshot = manifestSchema.parse(
    JSON.parse((await safeRead(root, 'manifest.json', 20_000_000)).toString('utf8')),
  );
  if (
    Object.keys(snapshot.resources).some(
      (key) => !syncResources.includes(key as (typeof syncResources)[number]),
    )
  )
    throw new Error('仓库包含未知资源类型');
  for (const resource of syncResources) {
    if (!snapshot.resources[resource]) throw new Error(`仓库缺少${resource}`);
    const seen = new Set<string>();
    for (const row of snapshot.resources[resource]) {
      if (seen.has(row.id)) throw new Error('资源ID重复');
      seen.add(row.id);
      const source = { ...row.data };
      if ('content' in schemas[resource].shape)
        source.content = new TextDecoder('utf-8', { fatal: true }).decode(
          await safeRead(root, `${resource}/${row.id}.md`),
        );
      row.data = schemas[resource].parse(source);
    }
  }
  const expectedAssets = new Set(
    snapshot.media.flatMap((item) =>
      [item.storagePath, item.thumbnailPath].map((url) => url.split('/').pop()!),
    ),
  );
  const checked = new Map<
    string,
    { size: number; format: string; width: number; height: number }
  >();
  if (expectedAssets.size !== Object.keys(snapshot.assets).length)
    throw new Error('媒体清单不一致');
  for (const name of expectedAssets) {
    uploadPath(name);
    const bytes = await safeRead(root, `assets/${name}`, 10_485_760);
    if (digest(bytes) !== snapshot.assets[name]) throw new Error('图片完整性校验失败');
    const info = await sharp(bytes, { limitInputPixels: 40_000_000, animated: true }).metadata();
    if (!['webp', 'gif'].includes(info.format ?? '')) throw new Error('仓库图片格式无效');
    if (!name.endsWith(`.${info.format}`)) throw new Error('图片扩展名与实际格式不一致');
    checked.set(name, {
      size: bytes.length,
      format: info.format!,
      width: info.width ?? 0,
      height: info.pageHeight ?? info.height ?? 0,
    });
  }
  for (const item of snapshot.media) {
    const image = checked.get(item.storagePath.split('/').pop()!)!;
    if (
      image.size !== item.size ||
      `image/${image.format}` !== item.mimeType ||
      image.width !== item.width ||
      image.height !== item.height
    )
      throw new Error('图片元数据与文件不一致');
    if (checked.get(item.thumbnailPath.split('/').pop()!)?.format !== 'webp')
      throw new Error('缩略图格式无效');
  }
  return snapshot;
}

export function summarizeSnapshot(local: Snapshot, remote: Snapshot) {
  return syncResources.map((resource) => {
    const current = new Map(local.resources[resource].map((row) => [row.id, JSON.stringify(row)]));
    const incoming = new Map(
      remote.resources[resource].map((row) => [row.id, JSON.stringify(row)]),
    );
    return {
      resource,
      added: [...incoming.keys()].filter((id) => !current.has(id)).length,
      updated: [...incoming].filter(([id, value]) => current.has(id) && current.get(id) !== value)
        .length,
      removed: [...current.keys()].filter((id) => !incoming.has(id)).length,
    };
  });
}

export async function installSnapshot(store: Store, snapshot: Snapshot, root: string) {
  // Stable IDs and explicit dependency order preserve novel/volume/chapter relations.
  for (const resource of [...syncResources].reverse()) {
    const table = delegate(store, resource) as unknown as { deleteMany(): Promise<unknown> };
    await table.deleteMany();
  }
  for (const resource of syncResources)
    for (const row of snapshot.resources[resource]) {
      const data: Record<string, unknown> = {
        ...row.data,
        id: row.id,
        ...(row.createdAt ? { createdAt: row.createdAt } : {}),
        ...(row.updatedAt ? { updatedAt: row.updatedAt } : {}),
      };
      const tagIds = data.tagIds as string[] | undefined;
      delete data.tagIds;
      if (tagIds) data.tags = { create: tagIds.map((tagId) => ({ tagId })) };
      await delegate(store, resource).create({ data });
    }
  await store.mediaAsset.deleteMany();
  await mkdir(uploadsDirectory, { recursive: true });
  for (const name of Object.keys(snapshot.assets)) {
    const target = uploadPath(name);
    const source = await safeRead(root, `assets/${name}`, 10_485_760);
    // Images have immutable names; refuse to overwrite different local bytes.
    const existing = await readFile(target).catch((error) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (existing && digest(existing) !== snapshot.assets[name])
      throw new Error('同名本地图片与仓库不同，请先处理冲突');
    if (!existing) await writeFile(target, source, { flag: 'wx' });
  }
  for (const item of snapshot.media) await store.mediaAsset.create({ data: item });
  for (const key of ['site', 'giscus'] as const)
    await store.siteSetting.upsert({
      where: { key },
      create: { key, value: snapshot.settings[key] as Prisma.InputJsonValue },
      update: { value: snapshot.settings[key] as Prisma.InputJsonValue },
    });
}
