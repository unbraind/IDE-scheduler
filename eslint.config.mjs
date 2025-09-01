// Flat ESLint config for ESLint v9+
// Keeps rules minimal to ensure CI passes; extend as needed.

export default [
  {
    ignores: [
      '**/node_modules/**',
      'dist/**',
      'out/**',
      'bin/**',
      'webview-ui/**/build/**',
      'e2e/**/dist/**',
    ],
  },
  {
    files: ['src/**/*.ts', 'scripts/**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true }],
      'no-undef': 'off',
      'prefer-const': 'warn',
      'no-console': 'off',
    },
  },
]

