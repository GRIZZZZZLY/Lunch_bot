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

/* Соединение с Redis закрывается после КАЖДОГО файла тестов.

   Клиент `cacheService` поднимается лениво, как только приложение впервые
   трогает кэш, и держит событийный цикл. С `REDIS_ENABLED=true` это выглядело
   так: сами тесты проходят за секунды, а процесс jest не завершается вовсе —
   в CI шаг висел бы до тайм-аута задания. Хук общий, потому что открыть
   соединение может любой набор, поднимающий приложение, а не только те, что
   работают с кэшем осознанно.

   Модуль подключается СВЕРХУ, а не через `require` внутри хука. Первая
   редакция делала именно так — и ломала прогон: к моменту `afterAll`
   окружение файла уже снесено, а `require` в нём даёт
   «You are trying to require a file after the Jest environment has been torn
   down». Ошибка не попадала в отчёт (все наборы зелёные), но процесс
   завершался кодом 1 — красный CI без единого сообщения о причине.

   Наборы, подменяющие `cache.service` моком, получат здесь свой мок:
   `jest.mock` действует на общий реестр модулей файла. */
import { cacheService } from '../services/cache.service';

afterAll(async () => {
  try {
    if (cacheService && typeof cacheService.close === 'function') {
      await cacheService.close();
    }
  } catch {
    /* Мок без `close` или уже закрытое соединение — закрывать нечего. */
  }
});
