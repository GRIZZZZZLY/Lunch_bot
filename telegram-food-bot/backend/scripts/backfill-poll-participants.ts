/**
 * Backfill PollParticipant snapshots for ACTIVE polls created before the feature shipped.
 * Idempotent — пропускает голосования, у которых снимок уже есть.
 *
 * Run: npx tsx scripts/backfill-poll-participants.ts
 */
import { prisma } from '../src/database/client';
import { logger } from '../src/utils/logger';
import { PollService } from '../src/services/poll.service';

async function backfill() {
  const activePolls = await prisma.poll.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, groupId: true, _count: { select: { participants: true } } },
  });

  logger.info(`Found ${activePolls.length} ACTIVE polls`);

  let created = 0;
  let skipped = 0;

  for (const poll of activePolls) {
    if (poll._count.participants > 0) {
      skipped++;
      continue;
    }
    await PollService.createParticipantSnapshot(poll.id, poll.groupId);
    created++;
  }

  logger.info(`Backfill done: snapshot created for ${created} polls, ${skipped} skipped (already had snapshot)`);
}

backfill()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    logger.error('Backfill failed:', err);
    process.exit(1);
  });
