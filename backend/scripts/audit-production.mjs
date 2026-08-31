/**
 * Аудит production-зависимостей бекенда с одним точечным исключением.
 *
 * Прямой `npm audit --audit-level=high` красил CI на каждом пуше из-за
 * GHSA-ggr8-5vv4-36mx в `deepmerge-ts`. Три «уязвимости» в отчёте — одна и та
 * же: сама библиотека и две обёртки над ней, `@prisma/config` и `prisma`.
 *
 * Почему исключена. Это стековое переполнение при слиянии рекурсивных объектов.
 * Вызывает её только CLI Prisma, читая `prisma.config.ts` из репозитория; ни
 * один пользовательский ввод туда не доходит. Единственное «исправление»,
 * которое предлагает npm, — откат prisma до 6.12.0, то есть на семь минорных
 * версий назад, вместе со всеми их исправлениями.
 *
 * Исключение самоистекающее: оно привязано к версии prisma из package-lock.
 * Как только prisma обновится — хоть с починенным deepmerge-ts, хоть без, —
 * проверка снова станет красной и заставит перечитать эту причину, а не
 * унаследовать её молча. Тот же приём, что в frontend-new/scripts/audit-production.mjs.
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const ALLOWED_ADVISORY = 'GHSA-ggr8-5vv4-36mx';
// 7.9.1 всё ещё тянет deepmerge-ts 7.1.5; GHSA-ggr8-5vv4-36mx закрыт только
// в 8.0.0, поэтому исключение остаётся в силе и после перехода на Prisma 7.
const ALLOWED_PRISMA_VERSION = '7.9.1';
const npmCli = process.env.npm_execpath;

if (!npmCli) {
  console.error('Не удалось определить исполняемый файл npm.');
  process.exit(1);
}

const packageLock = JSON.parse(
  readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'),
);
const prismaPackage = packageLock.packages?.['node_modules/prisma'];
const allowDeepmergeAdvisory = prismaPackage?.version === ALLOWED_PRISMA_VERSION;

if (!allowDeepmergeAdvisory) {
  console.warn(
    `prisma в package-lock — ${prismaPackage?.version ?? 'не найдена'}, ` +
      `исключение выписано для ${ALLOWED_PRISMA_VERSION}. ` +
      'Проверьте, закрыта ли GHSA-ggr8-5vv4-36mx, и обновите константу или снимите исключение.',
  );
}

const audit = spawnSync(process.execPath, [npmCli, 'audit', '--omit=dev', '--json'], {
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
});

if (audit.error) {
  console.error(audit.error.message);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  process.stderr.write(audit.stderr);
  process.stdout.write(audit.stdout);
  console.error('npm audit вернул ответ в неизвестном формате.');
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities ?? {};

function advisoryId(via) {
  if (typeof via?.url !== 'string') return null;
  return via.url.split('/').at(-1) ?? null;
}

/* Обёртки уязвимы «через» другой пакет: рекурсия по via позволяет простить
   prisma и @prisma/config ровно тогда, когда прощён сам deepmerge-ts. */
function isAllowed(name, visited = new Set()) {
  if (visited.has(name)) return true;
  visited.add(name);

  const vulnerability = vulnerabilities[name];
  if (!vulnerability) return true;

  return vulnerability.via.every((via) => {
    if (typeof via === 'string') return isAllowed(via, visited);
    return allowDeepmergeAdvisory && advisoryId(via) === ALLOWED_ADVISORY;
  });
}

const blocking = Object.entries(vulnerabilities).filter(
  ([name, vulnerability]) =>
    ['high', 'critical'].includes(vulnerability.severity) && !isAllowed(name),
);

if (blocking.length > 0) {
  for (const [name, vulnerability] of blocking) {
    console.error(
      `${name}: обнаружена неисключённая уязвимость уровня ${vulnerability.severity}`,
    );
  }
  process.exit(1);
}

if (Object.keys(vulnerabilities).length > 0) {
  console.warn(
    `${ALLOWED_ADVISORY} учтена как неприменимая: deepmerge-ts вызывает только ` +
      'CLI Prisma на конфиге из репозитория, пользовательский ввод туда не доходит.',
  );
}

console.log('Проверка production-зависимостей пройдена.');
