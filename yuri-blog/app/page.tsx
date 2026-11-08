import { PublicSite } from '@/components/public/site';
import { publicMetadata } from '@/lib/seo';
export const dynamic = 'force-dynamic';
export async function generateMetadata() {
  return publicMetadata([]);
}
export default async function Home() {
  return <PublicSite />;
}
