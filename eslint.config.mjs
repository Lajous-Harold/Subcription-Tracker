import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import expoConfig from 'eslint-config-expo/flat.js';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'apps/mobile/.expo/**',
      'apps/mobile/android/**',
      'apps/mobile/ios/**',
      'apps/mobile/expo-env.d.ts',
    ],
  },
  // Backend et packages partagés
  {
    files: ['apps/api/**/*.ts', 'packages/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'error',
    },
  },
  // Application Expo
  ...expoConfig.map((config) => ({ ...config, files: ['apps/mobile/**/*.{ts,tsx,js}'] })),
  {
    files: ['apps/mobile/**/*.{ts,tsx,js}'],
    settings: {
      'import/resolver': { typescript: { project: 'apps/mobile/tsconfig.json' } },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
);
