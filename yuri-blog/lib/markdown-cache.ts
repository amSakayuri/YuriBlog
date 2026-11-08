import { unstable_cache } from 'next/cache';
import { renderMarkdown } from './markdown';
// Public rendering is keyed by the complete source. Draft previews bypass this cache.
export const publicMarkdown = unstable_cache(renderMarkdown, ['public-markdown'], {
  tags: ['content'],
  revalidate: 3600,
});
