import { publishDue } from '../yuri-blog/lib/content';
import { db } from '../yuri-blog/lib/db';
import { repositorySettings, synchronizeRepository } from '../yuri-blog/lib/repository';
let invalidationPending = false;
let running = false;
let synchronizing = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    if (await publishDue()) invalidationPending = true;
    if (invalidationPending) {
      const result = await fetch(
        `${process.env.INTERNAL_APP_URL ?? 'http://localhost:3000'}/api/internal/revalidate`,
        {
          method: 'POST',
          signal: AbortSignal.timeout(10000),
          headers: { authorization: `Bearer ${process.env.WORKER_SECRET}` },
        },
      );
      if (!result.ok) throw new Error(`Cache invalidation HTTP ${result.status}`);
      invalidationPending = false;
    }
    const repository = await repositorySettings();
    if (repository.enabled && repository.autoPush && !synchronizing) {
      synchronizing = true;
      void synchronizeRepository('push')
        .catch((error) =>
          console.error('Repository sync:', error instanceof Error ? error.message : 'failed'),
        )
        .finally(() => {
          synchronizing = false;
        });
    }
  } catch (error) {
    console.error('Worker retry next tick:', error instanceof Error ? error.message : 'error');
  } finally {
    running = false;
  }
}
await tick();
const timer = setInterval(tick, 30000);
process.on('SIGTERM', async () => {
  clearInterval(timer);
  await db.$disconnect();
  process.exit(0);
});
