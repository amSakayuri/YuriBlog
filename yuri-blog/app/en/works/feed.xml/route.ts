import { feed } from '@/lib/feed';
export const dynamic = 'force-dynamic';
export async function GET() {
  return feed('en', 'works');
}
