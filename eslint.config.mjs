import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'prisma/migrations', 'data'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['public/admin/**/*.js'], languageOptions: { sourceType: 'module', globals: globals.browser } },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
);
