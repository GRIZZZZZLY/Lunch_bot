#!/usr/bin/env node
/**
 * Ищет mojibake — русский текст, чьи UTF-8 байты были однажды прочитаны как
 * windows-1251 и записаны обратно. Выглядит так:  check-mojibake:allow
 *   `РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ` вместо `Инициализация`.  check-mojibake:allow
 *
 * Зачем гейт, а не разовая правка: порча уже случалась и доехала до коммита в
 * шаблонах уведомлений — вот как это выглядело вместо `✅ Голосование
 * завершено!`:  `вњ… Р“РѕР»РѕСЃРѕРІР°РЅРёРµ Р·Р°РІРµСЂС€РµРЅРѕ!`  check-mojibake:allow
 * Комментарии от такой порчи только теряют читаемость, а строки уходят людям.
 *
 * Маркерный набор узкий намеренно. Широкий grep по `Р`/`С` даёт десятки ложных
 * срабатываний на нормальном русском тексте: `Р` — обычная буква.
 *
 * Прогон: node scripts/check-mojibake.mjs
 * Код возврата: 0 — чисто, 1 — найдено.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, extname, sep } from 'node:path';

const ROOT = process.cwd();

/** Каталоги, которые не наши или порождены инструментами. */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.vite',
  '.next',
  'playwright-report',
  'test-results',
  '.repowise',
  '.auto-claude',
  '.agent',
  '.impeccable',
  'logs',
]);

/**
 * Каталоги, где битые строки приведены КАК ПРИМЕРЫ и должны остаться.
 * Без этого исключения гейт краснеет в день добавления — и его выключают,
 * ровно как это уже случилось с порогом покрытия в backend/jest.config.js.
 */
const SKIP_PATH_PREFIXES = ['tech_debt', 'docs'];

/**
 * Пометка для одной строки, которая обязана содержать пример порчи.
 * Исключать по этой пометке, а не файл целиком: иначе новая порча внутри
 * самого гейта станет невидимой для него же.
 */
const ALLOW_MARKER = 'check-mojibake:allow';

const CHECK_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.md', '.css', '.html',
  '.ps1', '.sh', '.yml', '.yaml', '.conf',
]);

const MARKER = /Р[°Ѕµё‘‚]|С[‚†Ѓњ‹]/;

const hits = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const rel = relative(ROOT, full);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full);
      continue;
    }
    if (SKIP_PATH_PREFIXES.some(p => rel === p || rel.startsWith(p + sep))) {
      continue;
    }
    if (!CHECK_EXT.has(extname(entry.name))) continue;
    let text;
    try {
      text = readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    text.split(/\r?\n/).forEach((line, i) => {
      if (line.includes(ALLOW_MARKER)) return;
      if (MARKER.test(line)) {
        hits.push({ file: rel.replace(/\\/g, '/'), line: i + 1, text: line.trim().slice(0, 120) });
      }
    });
  }
}

walk(ROOT);

if (hits.length === 0) {
  console.log('check-mojibake: чисто');
  process.exit(0);
}

console.error(`check-mojibake: найдено ${hits.length} строк с битой кодировкой\n`);
for (const h of hits) {
  console.error(`  ${h.file}:${h.line}`);
  console.error(`    ${h.text}`);
}
console.error(
  '\nПочинить: взять байты строки, закодировать в windows-1251, прочитать как UTF-8.\n' +
    'Осторожно: байт 0x98 в windows-1251 НЕ ОПРЕДЕЛЁН, а «И» это D0 98 — в файле\n' +
    'он лежит управляющим символом U+0098, и iconv.encode подставит на его месте\n' +
    '"?" вместо байта. Нужна обратная таблица с тождеством для 0x80..0x9F.'
);
process.exit(1);

