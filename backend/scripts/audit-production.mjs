/**
 * Аудит production-зависимостей бекенда с несколькими точечными исключениями.
 *
 * Прямой `npm audit --audit-level=high` красит CI по двум независимым поводам,
 * оба приходят деревом зависимостей `prisma` и не имеют отношения к нашему коду:
 *
 * 1. GHSA-ggr8-5vv4-36mx в `deepmerge-ts` (стековое переполнение при слиянии
 *    рекурсивных объектов). Вызывает её только CLI Prisma, читая
 *    `prisma.config.ts` из репозитория; пользовательский ввод туда не доходит.
 *    Прощаются также обёртки `@prisma/config` и `prisma`, которые уязвимы
 *    «через» неё же.
 *
 * 2. Два advisory в `mysql2` — драйвере, который Prisma CLI подтягивает как
 *    один из движков для многобазовых команд (`db pull`, `migrate diff` и
 *    т.п.), а не как то, что реально используется в рантайме: проект работает
 *    только с PostgreSQL через `@prisma/adapter-pg`, соединение с MySQL нигде
 *    не открывается.
 *    - GHSA-3f6p-5ww8-9rcr, high, `<3.22.0` — сервер, к которому подключается
 *      клиент, требует понизить плагин аутентификации до
 *      `mysql_clear_password` и получает пароль открытым текстом. Нужен
 *      реальный MySQL-сервер на другом конце соединения — у нас его нет.
 *    - GHSA-rgwj-5xj2-c3m3, moderate, `<=3.23.0` — неограниченный zlib
 *      inflate в обработчике сжатого протокола MySQL, DoS через
 *      decompression bomb. Тоже требует активного MySQL-соединения и пакета
 *      от сервера. Сама по себе moderate не валит прогон (порог — high), но
 *      перечислена явно: `isAllowed` ниже прощает обёртку (`mysql2`, `prisma`)
 *      только когда прощены ВСЕ её причины по `via`, а у `mysql2` их две.
 *      Без этой записи рекурсия наткнётся на неисключённый moderate-advisory
 *      и не пропустит саму упаковку — хотя severity moderate и так не блокирует
 *      напрямую.
 *
 * Единственное, что предлагает npm для устранения обеих проблем, — откат
 * `prisma` до 6.x, то есть отмена перехода на Prisma 7. Не вариант.
 *
 * Оба исключения самоистекающие и независимы друг от друга: каждое привязано
 * к версии своего пакета в package-lock.json (prisma — потому что именно он
 * тянет deepmerge-ts нужной версии; mysql2 — напрямую, т.к. диапазоны CVE
 * заданы в терминах его собственной версии). Как только соответствующая
 * версия сдвинется, привязанные к ней advisory перестают считаться
 * исключёнными: если severity high — прогон снова покраснеет, а warning ниже
 * печатается в любом случае и заставляет перечитать эту причину, а не
 * унаследовать её молча. Тот же приём, что в
 * frontend-new/scripts/audit-production.mjs.
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const npmCli = process.env.npm_execpath;

if (!npmCli) {
  console.error('Не удалось определить исполняемый файл npm.');
  process.exit(1);
}

const packageLock = JSON.parse(
  readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'),
);

function lockedVersion(packageName) {
  return packageLock.packages?.[`node_modules/${packageName}`]?.version;
}

// 7.9.1 всё ещё тянет deepmerge-ts 7.1.5; GHSA-ggr8-5vv4-36mx закрыт только
// в 8.0.0, поэтому исключение остаётся в силе и после перехода на Prisma 7.
const ALLOWED_PRISMA_VERSION = '7.9.1';
// Обе уязвимости mysql2 закрыты выше этой версии (3.22.0 и 3.23.0
// соответственно); 3.15.3 попадает в оба диапазона.
const ALLOWED_MYSQL2_VERSION = '3.15.3';

const actualPrismaVersion = lockedVersion('prisma');
const actualMysql2Version = lockedVersion('mysql2');

const prismaVersionMatches = actualPrismaVersion === ALLOWED_PRISMA_VERSION;
const mysql2VersionMatches = actualMysql2Version === ALLOWED_MYSQL2_VERSION;

if (!prismaVersionMatches) {
  console.warn(
    `prisma в package-lock — ${actualPrismaVersion ?? 'не найдена'}, ` +
      `исключение GHSA-ggr8-5vv4-36mx выписано для ${ALLOWED_PRISMA_VERSION}. ` +
      'Проверьте, закрыта ли уязвимость в новой версии deepmerge-ts, и обновите константу или снимите исключение.',
  );
}

if (!mysql2VersionMatches) {
  console.warn(
    `mysql2 в package-lock — ${actualMysql2Version ?? 'не найдена'}, ` +
      `исключения GHSA-3f6p-5ww8-9rcr и GHSA-rgwj-5xj2-c3m3 выписаны для ${ALLOWED_MYSQL2_VERSION}. ` +
      'Проверьте, закрыты ли эти advisory в новой версии, и обновите константу или снимите исключения.',
  );
}

/*
 * Один ключ — один advisory. `allowed` пересчитывается при каждом запуске из
 * привязки к версии пакета выше: как только версия сдвинется, `allowed`
 * станет false и advisory снова начнёт валить прогон (для high/critical) или
 * хотя бы перестанет учитываться как обоснованное.
 */
const ALLOWED_ADVISORIES = {
  'GHSA-ggr8-5vv4-36mx': {
    package: 'deepmerge-ts',
    allowed: prismaVersionMatches,
    reason:
      'Стековое переполнение при слиянии рекурсивных объектов. Вызывает только ' +
      'CLI Prisma, читая prisma.config.ts из репозитория; пользовательский ввод туда не доходит.',
  },
  'GHSA-3f6p-5ww8-9rcr': {
    package: 'mysql2',
    allowed: mysql2VersionMatches,
    reason:
      'Понижение плагина аутентификации до mysql_clear_password раскрывает пароль ' +
      'открытым текстом — требует MySQL-сервера, который его потребует. Проект работает ' +
      'только с PostgreSQL через @prisma/adapter-pg, MySQL-соединение никогда не открывается.',
  },
  'GHSA-rgwj-5xj2-c3m3': {
    package: 'mysql2',
    allowed: mysql2VersionMatches,
    reason:
      'Moderate, сама по себе прогон не валит (порог — high/critical). Перечислена явно, ' +
      'потому что isAllowed прощает mysql2 и prisma только когда прощены ВСЕ причины из via, ' +
      'а у mysql2 их две. Требует MySQL-соединения и сжатого пакета от сервера — как и первое ' +
      'advisory, неприменима: проект работает только с PostgreSQL.',
  },
};

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
   prisma и @prisma/config, только когда прощены ВСЕ их причины. */
function isAllowed(name, visited = new Set()) {
  if (visited.has(name)) return true;
  visited.add(name);

  const vulnerability = vulnerabilities[name];
  if (!vulnerability) return true;

  return vulnerability.via.every((via) => {
    if (typeof via === 'string') return isAllowed(via, visited);
    const id = advisoryId(via);
    return Boolean(id && ALLOWED_ADVISORIES[id]?.allowed);
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
  for (const [id, exception] of Object.entries(ALLOWED_ADVISORIES)) {
    if (!exception.allowed) continue;
    console.warn(`${id} (${exception.package}) учтена как неприменимая: ${exception.reason}`);
  }
}

console.log('Проверка production-зависимостей пройдена.');
