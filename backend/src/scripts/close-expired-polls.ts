/**
 * Ручное закрытие просроченных голосований.
 * Использование: npm run close-expired-polls
 *
 * Нужен, когда планировщик простаивал: рестарт, недоступная БД, отключённый
 * процесс. В обычной жизни то же самое делает `poll-scheduler` раз в минуту.
 *
 * Скрипт НЕ содержит собственного правила «голосование просрочено» и не решает
 * сам, завершать его или отменять: правило живёт в `closeExpiredPoll`, и
 * скрипт с планировщиком закрывают голосования одинаково — с голосами
 * завершают, пустые отменяют. Пока копия правила жила здесь, она расходилась с
 * планировщиком: ставила `COMPLETED` вместо `CANCELLED` (одно и то же событие
 * выглядело в истории по-разному) и не сбрасывала кэш группы после закрытия.
 */

import { prisma } from '../database/client';
import { PollCompletionService } from '../services/poll-completion.service';
import { closeExpiredPoll } from '../services/poll-timer.service';
import { isPollOver, pollEndsAt } from '../utils/date';

async function closeExpiredPolls() {
  console.log('');
  console.log('========================================');
  console.log('  Close Expired Polls');
  console.log('========================================');
  console.log('');

  try {
    const now = new Date();

    // Отчёт до закрытия: что именно будет тронуто и как давно оно висит.
    const active = await prisma.poll.findMany({
      where: { status: 'ACTIVE' },
      include: { group: true },
    });
    const expired = active.filter(poll => isPollOver(poll, now));

    if (expired.length === 0) {
      console.log('✅ No expired polls found!');
      console.log('');
      return;
    }

    console.log(`⚠️  Found ${expired.length} expired poll(s):`);
    console.log('');

    for (const poll of expired) {
      const endsAt = pollEndsAt(poll);
      const hoursSinceEnd = Math.floor((now.getTime() - endsAt.getTime()) / (1000 * 60 * 60));

      console.log(`  Poll ID: ${poll.id}`);
      console.log(`  Group: ${poll.group.title} (ID: ${poll.groupId})`);
      console.log(`  Ended at: ${endsAt.toISOString()}`);
      console.log(`  Hours ago: ${hoursSinceEnd}h`);
      console.log('');
    }

    const rows = await PollCompletionService.findExpiredActivePolls(now);
    let completed = 0;
    let cancelled = 0;
    for (const poll of rows) {
      const outcome = await closeExpiredPoll(poll);
      if (outcome === 'completed') completed += 1;
      if (outcome === 'cancelled') cancelled += 1;
    }

    console.log(
      `✅ Завершено: ${completed}, отменено (без голосов): ${cancelled}`
    );
    const closed = completed + cancelled;
    if (closed !== expired.length) {
      // Разница — не ошибка: голосование мог закрыть планировщик или человек
      // между отчётом и записью. Оптимистичная блокировка это и ловит.
      console.log(`ℹ️  ${expired.length - closed} закрыл кто-то другой параллельно`);
    }
    console.log('');
    console.log('========================================');
    console.log('');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем скрипт
closeExpiredPolls()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
