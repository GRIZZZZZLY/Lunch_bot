/**
 * Счётчик явных `any` в продакшен-коде сервера.
 *
 * Зачем отдельный скрипт, а не `error` у правила: явных `any` в дереве
 * несколько сотен, и включение `error` остановило бы CI на первом запуске —
 * такое правило возвращают в `off` через день. Поэтому правило стоит на `warn`
 * (видно в редакторе и в выводе lint), а гейт держит только ОДНУ вещь: число
 * `any` не растёт.
 *
 * Считает не регуляркой, а самим ESLint: срабатывания `no-explicit-any`. Иначе
 * в счёт попадали бы слова `any` из комментариев и строк, и порог пришлось бы
 * переписывать после каждой правки текста.
 *
 * Что НЕ считается: тесты (`__tests__`, `*.test.ts`) и `src/scripts/**` —
 * разовые операторские скрипты. Решение из задачи tech_debt/10: отдача от
 * типизации там нулевая, а шум в пороге мешал бы видеть регресс продакшена.
 *
 * Порог обновляется ВНИЗ по мере типизации. Вверх — только вместе с
 * объяснением в задаче, иначе гейт бессмысленен.
 */
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';

/**
 * Замер на 2026-08-24, после типизации клавиатур бота, `savePollResult` и
 * хранимых экземпляров бота в планировщике и обратной связи.
 * Число измерено этим же скриптом, а не взято из плана задачи: там стояло 336
 * вхождений `any`/`as any`/`@ts-ignore` во всём дереве, включая тесты и
 * одноразовые скрипты.
 */
const THRESHOLD = 159;

const IGNORED = [/__tests__/, /\.test\.ts$/, /[\\/]src[\\/]scripts[\\/]/];

/* `fileURLToPath`, а не `url.pathname`: на Windows второй отдаёт `/E:/...`, и
   ESLint не находит ни одного файла. */
const eslint = new ESLint({ cwd: fileURLToPath(new URL('..', import.meta.url)) });
const results = await eslint.lintFiles(['src/**/*.ts']);

let count = 0;
const perFile = [];

for (const result of results) {
  if (IGNORED.some(pattern => pattern.test(result.filePath))) continue;

  const hits = result.messages.filter(
    message => message.ruleId === '@typescript-eslint/no-explicit-any'
  ).length;

  if (hits > 0) {
    count += hits;
    perFile.push([result.filePath, hits]);
  }
}

console.log(`explicit any in production code: ${count} (threshold ${THRESHOLD})`);

if (count > THRESHOLD) {
  perFile
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([file, hits]) => console.log(`  ${hits}\t${file}`));
  console.error(
    `\nany count grew: ${count} > ${THRESHOLD}. ` +
      'Типизируйте новое место или объясните рост в tech_debt/10-any-on-api-boundary.md.'
  );
  process.exit(1);
}

if (count < THRESHOLD) {
  console.log(
    `Порог можно опустить до ${count} — правьте THRESHOLD в scripts/check-any-count.mjs.`
  );
}
