import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const ALLOWED_ADVISORY = 'GHSA-qwww-vcr4-c8h2';
const ALLOWED_REACT_ROUTER_VERSION = '7.18.1';
const npmCli = process.env.npm_execpath;

if (!npmCli) {
  console.error('Не удалось определить исполняемый файл npm.');
  process.exit(1);
}

const packageLock = JSON.parse(
  readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'),
);
const routerPackage =
  packageLock.packages?.['node_modules/react-router'];
const allowRscAdvisory =
  routerPackage?.version === ALLOWED_REACT_ROUTER_VERSION;

const audit = spawnSync(
  process.execPath,
  [npmCli, 'audit', '--omit=dev', '--json'],
  {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  },
);

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

function isAllowed(name, visited = new Set()) {
  if (visited.has(name)) return true;
  visited.add(name);

  const vulnerability = vulnerabilities[name];
  if (!vulnerability) return true;

  return vulnerability.via.every(via => {
    if (typeof via === 'string') {
      return isAllowed(via, visited);
    }

    return (
      allowRscAdvisory &&
      name === 'react-router' &&
      advisoryId(via) === ALLOWED_ADVISORY
    );
  });
}

const blocking = Object.entries(vulnerabilities).filter(
  ([name, vulnerability]) =>
    ['high', 'critical'].includes(vulnerability.severity) &&
    !isAllowed(name),
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
    `${ALLOWED_ADVISORY} учтена как неприменимая: Rocket Lunch использует ` +
      'BrowserRouter и не включает экспериментальные серверные компоненты.',
  );
}

console.log('Проверка production-зависимостей пройдена.');
