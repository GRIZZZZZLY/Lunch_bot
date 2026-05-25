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

// Increase timeout for integration tests
jest.setTimeout(10000);
