// Test setup file
// Runs before each test file

// Set test environment
process.env.NODE_ENV = 'test';
// Используем выделенную PostgreSQL test-БД (создаётся в globalSetup.ts).
// TEST_DATABASE_URL имеет приоритет — для CI с собственным PG-сервисом.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://foodbot:foodbot_password@localhost:5432/foodbot_test_db';

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

/* Таймаут одного теста.
   10 секунд хватало без покрытия, но под `--coverage` первый запрос в
   supertest-наборах падал по таймауту: инструментируется всё приложение
   целиком (helmet, роуты, Prisma), и ленивая загрузка на первом запросе
   занимает секунды. CI гоняет прогон именно с покрытием и на более слабой
   машине, поэтому падало не каждый раз — то есть в виде флака, который
   выглядит как «иногда красный CI» и приучает перезапускать прогон. */
jest.setTimeout(30000);
