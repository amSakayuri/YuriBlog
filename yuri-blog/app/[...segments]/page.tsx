import { PublicSite } from '@/components/public/site';
import { publicMetadata } from '@/lib/seo';
import {Metadata} from "next";
export const dynamic = 'force-dynamic';
type Props = {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<Record<string, string | undefined>>;
};
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return publicMetadata((await params).segments);
}
export default async function PublicPage({ params, searchParams }: Props) {
  return <PublicSite segments={(await params).segments} query={await searchParams} />;
}
