import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { apiError } from '@/lib/http';
export async function GET() {
  try {
    await requireUser(['ADMIN', 'SUPER_ADMIN']);
    return Response.json(
      await db.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: { actor: { select: { name: true } } },
      }),
    );
  } catch (error) {
    return apiError(error);
  }
}
