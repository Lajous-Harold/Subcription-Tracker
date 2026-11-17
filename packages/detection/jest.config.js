/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: { '^.+\.ts$': ['ts-jest', { useESM: true }] },
  testMatch: ['<rootDir>/test/**/*.test.ts'],
};
