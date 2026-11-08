import type { PrismaClient } from '@prisma/client';
import { db } from './db';
import { schemas } from './validation';
import { writeContent } from './content';

export async function saveAbout(input: unknown, actorId: string, store: PrismaClient = db) {
  const page = schemas.pages.parse(input);
  const existing = await store.page.findUnique({
    where: { language_slug: { language: page.language, slug: 'about' } },
  });
  return writeContent('pages', { ...page, slug: 'about' }, actorId, existing?.id, store);
}
