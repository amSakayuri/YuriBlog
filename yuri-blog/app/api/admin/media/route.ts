import { unlink } from 'node:fs/promises';
import { z } from 'zod';
import { requireUser, checkOrigin, HttpError } from '@/lib/auth';
import { db } from '@/lib/db';
import { uploadImage, mediaReferences, uploadPath } from '@/lib/media';
import { apiError } from '@/lib/http';
export async function GET(request: Request) {
  try {
    await requireUser();
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (id) {
      const asset = await db.mediaAsset.findUniqueOrThrow({ where: { id } });
      return Response.json(await mediaReferences(asset.storagePath));
    }
    return Response.json(
      await db.mediaAsset.findMany({
        where: { filename: { contains: url.searchParams.get('q') ?? '', mode: 'insensitive' } },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    const data = await request.formData();
    const files = data.getAll('files');
    if (!files.length || files.length > 10) throw new HttpError(400, '每次选择 1–10 张图片');
    const result = [];
    for (const file of files) {
      if (!(file instanceof File)) throw new HttpError(400, '无效文件');
      result.push(await uploadImage(file, user.id));
    }
    return Response.json(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
export async function PUT(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    const { id, alt } = z
      .object({ id: z.string(), alt: z.string().max(1000) })
      .parse(await request.json());
    const result = await db.$transaction(async (tx) => {
      const item = await tx.mediaAsset.update({ where: { id }, data: { alt } });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'UPDATE',
          resource: 'media',
          targetId: id,
          result: 'SUCCESS',
        },
      });
      return item;
    });
    return Response.json(result);
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    const id = new URL(request.url).searchParams.get('id');
    if (!id) throw new HttpError(400, '缺少 ID');
    const asset = await db.mediaAsset.findUniqueOrThrow({ where: { id } });
    const refs = await mediaReferences(asset.storagePath);
    if (refs.length)
      throw new HttpError(
        409,
        `图片仍被 ${refs.map((r) => r.title).join('、')} 引用，请先移除引用`,
      );
    await db.$transaction(async (tx) => {
      await tx.mediaAsset.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'DELETE',
          resource: 'media',
          targetId: id,
          result: 'SUCCESS',
        },
      });
    });
    await Promise.allSettled([
      unlink(uploadPath(asset.storagePath.split('/').pop()!)),
      unlink(uploadPath(asset.thumbnailPath.split('/').pop()!)),
    ]);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
