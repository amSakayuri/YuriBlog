import { revalidatePath, revalidateTag } from 'next/cache';
export function invalidateContent() {
  revalidateTag('content', { expire: 0 });
  revalidatePath('/', 'layout');
}
