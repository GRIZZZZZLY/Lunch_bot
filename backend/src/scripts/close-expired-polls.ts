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
 *
 * Обход просроченных защищён на КАЖДОЙ итерации, и это не перестраховка:
 * скрипт запускают ровно тогда, когда планировщик простаивал, и одно
 * испорченное голосование иначе навсегда заблокировало бы закрытие всех
 * остальных — каждый следующий запуск падал бы на той же строке. Число
 * неудач видно в отчёте, и при неудачах код выхода ненулевой: иначе тихий
 * сбой вернулся бы с другой стороны — «скрипт прошёл», а голосования висят.
 */

import { prisma } from '../database/client';
import { PollCompletionService } from '../services/poll-completion.service';
import { closeExpiredPoll } from '../services/poll-timer.service';
import { isPollOver, pollEndsAt } from '../utils/date';

/** Возвращает число голосований, которые закрыть не удалось. */
async function closeExpiredPolls(): Promise<number> {
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
      return 0;
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
    let failed = 0;
    for (const poll of rows) {
      try {
        const outcome = await closeExpiredPoll(poll);
        if (outcome === 'completed') completed += 1;
        if (outcome === 'cancelled') cancelled += 1;
      } catch (error) {
        failed += 1;
        console.error(
          `❌ Голосование ${poll.id} (группа ${poll.groupId}) не закрылось:`,
          error
        );
      }
    }

    console.log(
      `✅ Завершено: ${completed}, отменено (без голосов): ${cancelled}`
    );
    if (failed > 0) {
      console.log(`❌ Не закрылось: ${failed} — причины выше, код выхода 1`);
    }

    /* В `accounted` входят и неудачи: иначе они попали бы в строку «закрыл
       кто-то другой», то есть сбой выглядел бы как безобидная гонка. */
    const accounted = completed + cancelled + failed;
    if (accounted !== expired.length) {
      // Разница — не ошибка: голосование мог закрыть планировщик или человек
      // между отчётом и записью. Оптимистичная блокировка это и ловит.
      console.log(
        `ℹ️  ${expired.length - accounted} закрыл кто-то другой параллельно`
      );
    }
    console.log('');
    console.log('========================================');
    console.log('');

    return failed;
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/** Код выхода: 0 — всё закрыто, 1 — хотя бы одно голосование не закрылось. */
export async function main(): Promise<number> {
  const failed = await closeExpiredPolls();
  return failed > 0 ? 1 : 0;
}

/* Автозапуск только при прямом вызове (`npm run close-expired-polls`): иначе
   импорт файла — например из теста — сам пошёл бы закрывать голосования. */
if (require.main === module) {
  main()
    .then(code => {
      process.exit(code);
    })
    .catch((error: unknown) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}
