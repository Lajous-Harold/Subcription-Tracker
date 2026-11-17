/**
 * Jest + Supertest. Le code de l'API est en ESM (`"type": "module"`) et nock n'est publié qu'en ESM :
 * Jest tourne donc en mode ESM natif (`--experimental-vm-modules`, cf. script `test`).
 * @type {import('jest').Config}
 */
export default {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: { '^.+\.ts$': ['ts-jest', { useESM: true }] },
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  globalSetup: '<rootDir>/test/global-setup.ts',
  globalTeardown: '<rootDir>/test/global-teardown.ts',
  setupFiles: ['<rootDir>/test/env.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  // Une seule base de test partagée : les fichiers s'exécutent en série.
  maxWorkers: 1,
  testTimeout: 30_000,
};
