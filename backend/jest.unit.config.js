const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  globalSetup: undefined,
  testMatch: ['**/__tests__/unit/**/*.test.ts'],
};
