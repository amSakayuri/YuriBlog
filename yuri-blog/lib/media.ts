import path from 'node:path';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { db } from './db';
import { HttpError } from './auth';
export const uploadsDirectory = path.resolve(
  /* turbopackIgnore: true */ process.env.UPLOAD_DIR ?? './.local/uploads',
);
export function uploadPath(filename: string) {
  if (!/^[a-zA-Z0-9_-]+\.(webp|gif)$/.test(filename)) throw new HttpError(400, '无效文件路径');
  return path.join(/* turbopackIgnore: true */ uploadsDirectory, filename);
}
export async function uploadImage(file: File, actorId: string) {
  if (file.size > 10 * 1024 * 1024 || !file.size)
    throw new HttpError(400, '图片须为 1 字节至 10 MB');
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type))
    throw new HttpError(400, '只允许 PNG、JPEG、WebP、GIF');
  const buffer = Buffer.from(await file.arrayBuffer());
  const image = sharp(buffer, { limitInputPixels: 40000000, animated: true });
  let meta;
  try {
    meta = await image.metadata();
  } catch {
    throw new HttpError(400, '无法识别图片内容');
  }
  if (!['png', 'jpeg', 'webp', 'gif'].includes(meta.format ?? ''))
    throw new HttpError(400, '图片真实格式不受支持');
  const declared: Record<string, string> = {
    png: 'image/png',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
  };
  if (declared[meta.format!] !== file.type) throw new HttpError(400, '图片格式与 MIME 不一致');
  const id = randomUUID();
  const extension = meta.format === 'gif' ? 'gif' : 'webp';
  const filename = `${id}.${extension}`;
  const thumbnail = `${id}-thumb.webp`;
  await mkdir(uploadsDirectory, { recursive: true });
  const output =
    extension === 'gif'
      ? await image.gif().toBuffer()
      : await image.webp({ quality: 88 }).toBuffer();
  await writeFile(uploadPath(filename), output);
  await sharp(buffer, { limitInputPixels: 40000000 })
    .resize(360, 360, { fit: 'inside', withoutEnlargement: true })
    .webp()
    .toFile(uploadPath(thumbnail));
  try {
    return await db.$transaction(async (tx) => {
      const asset = await tx.mediaAsset.create({
        data: {
          filename: file.name.slice(0, 255),
          mimeType: extension === 'gif' ? 'image/gif' : 'image/webp',
          size: output.length,
          width: meta.width ?? 0,
          height: meta.pageHeight ?? meta.height ?? 0,
          storagePath: `/uploads/${filename}`,
          thumbnailPath: `/uploads/${thumbnail}`,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'UPLOAD',
          resource: 'media',
          targetId: asset.id,
          result: 'SUCCESS',
        },
      });
      return asset;
    });
  } catch (error) {
    await Promise.allSettled([unlink(uploadPath(filename)), unlink(uploadPath(thumbnail))]);
    throw error;
  }
}
export async function mediaReferences(url: string) {
  const [articles, essays, chapters, novels, projects, pages, settings] = await Promise.all([
    db.article.findMany({
      where: { OR: [{ content: { contains: url } }, { cover: url }, { ogImage: url }] },
      select: { id: true, title: true },
    }),
    db.essay.findMany({
      where: { OR: [{ content: { contains: url } }, { cover: url }, { ogImage: url }] },
      select: { id: true, title: true },
    }),
    db.novelChapter.findMany({
      where: { content: { contains: url } },
      select: { id: true, title: true },
    }),
    db.novel.findMany({ where: { cover: url }, select: { id: true, title: true } }),
    db.project.findMany({
      where: {
        OR: [{ content: { contains: url } }, { cover: url }, { screenshots: { has: url } }],
      },
      select: { id: true, title: true },
    }),
    db.page.findMany({ where: { content: { contains: url } }, select: { id: true, title: true } }),
    db.siteSetting.findMany(),
  ]);
  return [
    ...articles,
    ...essays,
    ...chapters,
    ...novels,
    ...projects,
    ...pages,
    ...settings
      .filter((s) => JSON.stringify(s.value).includes(url))
      .map((s) => ({ id: s.key, title: `设置：${s.key}` })),
  ];
}
