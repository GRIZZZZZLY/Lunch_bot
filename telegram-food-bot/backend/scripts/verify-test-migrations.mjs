import { spawnSync } from 'node:child_process';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (process.env.NODE_ENV !== 'test' || !databaseUrl) {
  throw new Error(
    'Migration verification requires NODE_ENV=test and TEST_DATABASE_URL.',
  );
}

const parsedUrl = new URL(databaseUrl);
const databaseName = parsedUrl.pathname.slice(1).toLowerCase();

if (!databaseName.includes('test')) {
  throw new Error(
    `Refusing to reset a database whose name does not contain "test": ${databaseName}`,
  );
}

const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const runPrisma = args => {
  const result = spawnSync(executable, ['prisma', ...args], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

runPrisma(['migrate', 'reset', '--force', '--skip-seed']);
runPrisma(['migrate', 'status']);
