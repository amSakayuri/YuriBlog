import { readFile } from 'node:fs/promises';
import { uploadPath } from '@/lib/media';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  try {
    const { filename } = await params;
    const file = await readFile(uploadPath(filename));
    return new Response(file, {
      headers: {
        'Content-Type': filename.endsWith('.gif') ? 'image/gif' : 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
