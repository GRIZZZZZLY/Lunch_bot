/**
 * Лимиты размера собранного бандла.
 *
 * Работает как порог покрытия: это ПОТОЛОК, равный измеренному размеру плюс
 * запас, а не пожелание. Смысл — поймать случайность: затянутую целиком
 * библиотеку графиков, забытый moment.js с локалями, картинку в 2 МБ вместо
 * иконки. Обычная работа над функциями в запас укладывается.
 *
 * Значения НЕ унаследованы от прежнего интерфейса: там лимиты были втрое выше
 * (1.75 МБ JS), и под них влезло бы что угодно. Замер frontend-new на
 * 2026-08-03: JS 447 KiB, крупнейший чанк 320 KiB, CSS 84 KiB, всего 662 KiB.
 * Ниже — эти числа с запасом около 20%.
 *
 * Если лимит уперся: сначала посмотрите, ЧТО выросло (`npm run build` печатает
 * размеры чанков), и только потом поднимайте цифру — вместе с объяснением, что
 * именно и зачем добавилось.
 */
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* Якорь на файл, а не на process.cwd(): скрипт запускают и из frontend-new,
   и из корня репозитория (`npm --prefix frontend-new run size:check`). */
const DIST_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'dist'
);

const LIMITS = {
  totalJavaScript: 550_000,
  largestJavaScript: 390_000,
  totalCss: 105_000,
  totalAssets: 800_000,
};

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolutePath)));
    } else if (!entry.name.endsWith('.map') && entry.name !== 'stats.html') {
      const fileStat = await stat(absolutePath);
      files.push({ path: absolutePath, size: fileStat.size });
    }
  }

  return files;
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

const files = await collectFiles(DIST_DIR);
const javascript = files.filter(file => file.path.endsWith('.js'));
const css = files.filter(file => file.path.endsWith('.css'));

const measurements = {
  totalJavaScript: javascript.reduce((sum, file) => sum + file.size, 0),
  largestJavaScript: Math.max(0, ...javascript.map(file => file.size)),
  totalCss: css.reduce((sum, file) => sum + file.size, 0),
  totalAssets: files.reduce((sum, file) => sum + file.size, 0),
};

let failed = false;
for (const [name, value] of Object.entries(measurements)) {
  const limit = LIMITS[name];
  const passed = value <= limit;
  const headroom = limit - value;
  process.stdout.write(
    `${passed ? 'PASS' : 'FAIL'} ${name}: ${formatBytes(value)} / ${formatBytes(limit)}` +
      `${passed ? ` (запас ${formatBytes(headroom)})` : ` (превышение ${formatBytes(-headroom)})`}\n`
  );
  failed ||= !passed;
}

if (failed) {
  process.stdout.write(
    '\nЛимит превышен. Посмотрите вывод `npm run build`: он печатает размер каждого чанка.\n'
  );
  process.exitCode = 1;
}
