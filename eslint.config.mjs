import config from '@kubosho/configs/eslint';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  ...config,
  {
    files: ['**/*.cjs', '**/*.mjs', '**/*.ts'],
    rules: {
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: ['**/*.config.*', '**/*.test.ts', '**/tools/**/*.ts'],
        },
      ],
    },
  },
]);
