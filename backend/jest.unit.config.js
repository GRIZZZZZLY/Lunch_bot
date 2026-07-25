const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  globalSetup: undefined,
  testMatch: [
    '**/__tests__/unit/**/*.test.ts',
    '**/services/__tests__/**/*.test.ts',
    '**/bot/**/__tests__/**/*.test.ts',
  ],
};
