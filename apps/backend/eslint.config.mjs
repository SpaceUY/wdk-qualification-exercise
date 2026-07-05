// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'typechain-types/**',
      'artifacts/**',
      'cache/**',
      'contracts/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Company standard: no `any`
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['test/**/*.ts'],
    rules: {
      // Jest hoists jest.mock() factories above imports, so referencing a helper
      // module from inside one needs an inline require() call — this is the
      // standard Jest pattern, not a real ESM/CJS violation.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];
